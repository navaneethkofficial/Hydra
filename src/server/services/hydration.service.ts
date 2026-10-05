import "server-only";
import type { DailySummary, LogSource, WaterLog } from "@prisma/client";

import { alertTone } from "@/lib/domain/alert";
import { computeProgress } from "@/lib/domain/progress";
import { evaluateReminder, type ReminderPlan } from "@/lib/domain/reminder-engine";
import { computeStreaks, streakMessage, type StreakSummary } from "@/lib/domain/streak";
import {
  addDays,
  daysBetween,
  eachDay,
  minutesOfDay,
  toDayKey,
  zonedTimeToInstant,
  type DayKey,
} from "@/lib/domain/time";
import { badRequest, notFound } from "@/server/http/errors";
import * as hydrationRepo from "@/server/repositories/hydration.repository";
import { loadContext, type HydrationContext } from "./context";
import type {
  DayDetailDto,
  DaySummaryDto,
  HistoryDto,
  HydrationProfileDto,
  LogWaterResultDto,
  ReminderDto,
  ReminderSettingsDto,
  StreakDto,
  TodayDto,
  WaterLogDto,
} from "@/types/api";
import type { LogWaterInput } from "@/server/validation/schemas";

/**
 * Hydration use-cases.
 *
 * All the orchestration lives here — routes only translate HTTP, and the pure
 * domain modules only do maths. That split is what lets a mobile client reuse
 * exactly this behaviour through a thin transport later.
 */

/** How much history the adaptive pace curve learns from. */
const PATTERN_WINDOW_DAYS = 21;
/** Days of outcomes loaded for streak maths. */
const STREAK_WINDOW_DAYS = 400;

// ---------------------------------------------------------------------------
// Today
// ---------------------------------------------------------------------------

export async function getToday(userId: string, now = new Date()): Promise<TodayDto> {
  const context = await loadContext(userId, now);
  const logs = await hydrationRepo.listLogsForDay(context.userId, context.today);
  const consumed = logs.reduce((total, log) => total + log.amount, 0);

  const [streak, reminder] = await Promise.all([
    buildStreak(context, consumed),
    buildReminder(context, consumed, lastLogAt(logs)),
  ]);

  return {
    date: context.today,
    timezone: context.timezone,
    greeting: greeting(context),
    progress: computeProgress(consumed, context.profile.dailyGoal),
    logs: logs.map(toLogDto),
    streak,
    reminder,
    profile: toProfileDto(context),
    settings: toSettingsDto(context),
  };
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

export async function logWater(
  userId: string,
  input: LogWaterInput,
  now = new Date(),
): Promise<LogWaterResultDto> {
  const context = await loadContext(userId, now);
  const { log, wasNew } = await persistLog(context, input);

  // Only the day the drink belongs to needs rebuilding — a drink queued offline
  // yesterday must not move today's numbers.
  const summary = await hydrationRepo.rebuildSummary(
    context.userId,
    log.dayKey,
    await resolveGoalForDay(context, log.dayKey),
  );

  const todayTotal =
    log.dayKey === context.today ? summary.totalAmount : await consumedToday(context);
  const progress = computeProgress(todayTotal, context.profile.dailyGoal);

  const logs = await hydrationRepo.listLogsForDay(context.userId, context.today);
  const [streak, reminder] = await Promise.all([
    buildStreak(context, todayTotal),
    buildReminder(context, todayTotal, lastLogAt(logs)),
  ]);

  return {
    log: toLogDto(log),
    progress,
    streak,
    reminder,
    // Only celebrate on the drink that crossed the line, and only for today.
    goalJustCompleted:
      wasNew &&
      log.dayKey === context.today &&
      progress.completed &&
      todayTotal - log.amount < context.profile.dailyGoal,
  };
}

/**
 * Replays a queue of drinks logged while offline.
 *
 * Each entry carries a `clientId`, so a flush that half-succeeded and gets
 * retried does not double-count anyone's water.
 */
export async function logWaterBatch(
  userId: string,
  entries: readonly LogWaterInput[],
  now = new Date(),
): Promise<{ today: TodayDto; accepted: number; duplicates: number }> {
  const context = await loadContext(userId, now);

  let accepted = 0;
  let duplicates = 0;
  const touchedDays = new Set<DayKey>();

  for (const entry of entries) {
    const { log, wasNew } = await persistLog(context, entry);
    touchedDays.add(log.dayKey);
    if (wasNew) accepted += 1;
    else duplicates += 1;
  }

  for (const dayKey of touchedDays) {
    await hydrationRepo.rebuildSummary(
      context.userId,
      dayKey,
      await resolveGoalForDay(context, dayKey),
    );
  }

  return { today: await getToday(userId, now), accepted, duplicates };
}

export async function deleteLog(userId: string, logId: string, now = new Date()): Promise<TodayDto> {
  const context = await loadContext(userId, now);

  const existing = await hydrationRepo.findLog(context.userId, logId);
  if (!existing) throw notFound("That drink has already been removed.");

  await hydrationRepo.deleteLog(context.userId, logId);
  await hydrationRepo.rebuildSummary(
    context.userId,
    existing.dayKey,
    await resolveGoalForDay(context, existing.dayKey),
  );

  return getToday(userId, now);
}

/**
 * Writes one drink, honouring the client's idempotency key.
 *
 * Returns `wasNew: false` when the drink was already recorded, so a retry is a
 * no-op rather than a duplicate.
 */
async function persistLog(
  context: HydrationContext,
  input: LogWaterInput,
): Promise<{ log: WaterLog; wasNew: boolean }> {
  if (input.clientId) {
    const existing = await hydrationRepo.findLogByClientId(context.userId, input.clientId);
    if (existing) return { log: existing, wasNew: false };
  }

  const loggedAt = resolveLoggedAt(input.loggedAt, context.now);
  const dayKey = toDayKey(loggedAt, context.timezone);

  try {
    const log = await hydrationRepo.createLog({
      userId: context.userId,
      amount: input.amount,
      loggedAt,
      dayKey,
      source: input.source as LogSource,
      clientId: input.clientId ?? null,
    });
    return { log, wasNew: true };
  } catch (error) {
    // Two flushes raced on the same clientId; the unique index caught it.
    if (input.clientId && isUniqueViolation(error)) {
      const existing = await hydrationRepo.findLogByClientId(context.userId, input.clientId);
      if (existing) return { log: existing, wasNew: false };
    }
    throw error;
  }
}

/**
 * A client may backdate a drink (it happened while offline) but not invent one
 * in the future, and not one older than a week — that is a broken clock, not a
 * memory.
 */
function resolveLoggedAt(raw: string | undefined, now: Date): Date {
  if (!raw) return now;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw badRequest("That timestamp didn't make sense.");
  if (parsed.getTime() > now.getTime() + 60_000) return now;
  if (now.getTime() - parsed.getTime() > 7 * 86_400_000) {
    throw badRequest("That drink is too far in the past to log.");
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export async function getHistory(
  userId: string,
  query: { from?: string; to?: string; days?: number },
  now = new Date(),
): Promise<HistoryDto> {
  const context = await loadContext(userId, now);

  const to = query.to ?? context.today;
  const from = query.from ?? addDays(to, -(query.days ?? 30) + 1);
  if (daysBetween(from, to) < 0) throw badRequest("That date range runs backwards.");
  if (daysBetween(from, to) > 400) throw badRequest("Try a shorter date range.");

  const summaries = await hydrationRepo.listSummaries(context.userId, from, to);
  const byDate = new Map(summaries.map((summary) => [summary.date, summary] as const));

  // Fill gaps so the calendar renders a complete grid without client-side logic.
  const days: DaySummaryDto[] = eachDay(from, to).map((date) => {
    const summary = byDate.get(date);
    return summary
      ? toSummaryDto(summary)
      : {
          date,
          totalAmount: 0,
          goal: context.profile.dailyGoal,
          percentage: 0,
          goalCompleted: false,
          logCount: 0,
        };
  });

  const logged = days.filter((day) => day.totalAmount > 0);
  const bestDay = logged.reduce<DaySummaryDto | null>(
    (best, day) => (!best || day.totalAmount > best.totalAmount ? day : best),
    null,
  );

  return {
    from,
    to,
    timezone: context.timezone,
    unit: context.profile.unit,
    days,
    totals: {
      averageDaily: logged.length
        ? Math.round(logged.reduce((sum, day) => sum + day.totalAmount, 0) / logged.length)
        : 0,
      daysLogged: logged.length,
      goalsReached: days.filter((day) => day.goalCompleted).length,
      bestDay,
    },
    streak: await buildStreak(context),
  };
}

export async function getDayDetail(
  userId: string,
  dayKey: DayKey,
  now = new Date(),
): Promise<DayDetailDto> {
  const context = await loadContext(userId, now);
  const [summary, logs] = await Promise.all([
    hydrationRepo.findSummary(context.userId, dayKey),
    hydrationRepo.listLogsForDay(context.userId, dayKey),
  ]);

  return {
    date: dayKey,
    summary: summary ? toSummaryDto(summary) : null,
    logs: logs.map(toLogDto),
  };
}

// ---------------------------------------------------------------------------
// Shared building blocks (also used by the insights service)
// ---------------------------------------------------------------------------

export async function buildStreak(
  context: HydrationContext,
  todayConsumedOverride?: number,
): Promise<StreakDto> {
  const from = addDays(context.today, -STREAK_WINDOW_DAYS);
  const summaries = await hydrationRepo.listSummaries(context.userId, from, context.today);

  const outcomes = summaries.map((summary) => ({
    date: summary.date,
    goalCompleted: summary.goalCompleted,
  }));

  // A drink logged in this same request may not be in the rollup we just read.
  if (todayConsumedOverride !== undefined) {
    const completed = todayConsumedOverride >= context.profile.dailyGoal;
    const existing = outcomes.find((outcome) => outcome.date === context.today);
    if (existing) existing.goalCompleted = completed;
    else outcomes.push({ date: context.today, goalCompleted: completed });
  }

  const summary = computeStreaks(outcomes, context.today);
  const completedDays = new Set(
    outcomes.filter((outcome) => outcome.goalCompleted).map((outcome) => outcome.date),
  );

  return {
    ...summary,
    message: streakMessage(summary),
    week: lastSevenDays(context.today).map((date) => ({
      date,
      label: weekdayLabel(date),
      completed: completedDays.has(date),
      isToday: date === context.today,
      isFuture: false,
    })),
  };
}

export async function buildReminder(
  context: HydrationContext,
  consumed: number,
  lastDrinkAt: Date | null,
): Promise<ReminderDto> {
  const { weights, days } = await learnHourlyPattern(context);

  const plan = evaluateReminder({
    now: context.now,
    timezone: context.timezone,
    goal: context.profile.dailyGoal,
    consumed,
    lastDrinkAt,
    wakeTime: context.profile.wakeTime,
    sleepTime: context.profile.sleepTime,
    defaultServing: context.profile.defaultServing,
    preferences: toSettingsDto(context),
    hourlyPattern: weights,
    patternDays: days,
  });

  return toReminderDto(plan, context.reminders.enabled, weights, days);
}

/**
 * Learns when this person actually drinks, from the last three weeks.
 *
 * Returned as relative weights per hour of local time; the pace curve blends
 * them with the population shape according to how much history there is.
 */
export async function learnHourlyPattern(
  context: HydrationContext,
): Promise<{ weights: number[] | null; days: number; totals: number[] }> {
  const fromDay = addDays(context.today, -PATTERN_WINDOW_DAYS);
  const from = zonedTimeToInstant(fromDay, 0, context.timezone);
  const logs = await hydrationRepo.listLogsBetween(context.userId, from, context.now);

  const totals = new Array<number>(24).fill(0);
  const days = new Set<string>();

  for (const log of logs) {
    const hour = Math.floor(minutesOfDay(log.loggedAt, context.timezone) / 60);
    totals[hour] = (totals[hour] ?? 0) + log.amount;
    days.add(log.dayKey);
  }

  const observedDays = days.size;
  return {
    weights: observedDays >= 3 ? totals : null,
    days: observedDays,
    totals,
  };
}

async function consumedToday(context: HydrationContext): Promise<number> {
  const summary = await hydrationRepo.findSummary(context.userId, context.today);
  return summary?.totalAmount ?? 0;
}

/**
 * The goal that applies to a given day.
 *
 * Days already recorded keep the goal they were measured against — raising your
 * target today must not retroactively un-complete last Tuesday. Today and any
 * day with no history yet use the current target.
 */
async function resolveGoalForDay(context: HydrationContext, dayKey: DayKey): Promise<number> {
  if (dayKey >= context.today) return context.profile.dailyGoal;
  const existing = await hydrationRepo.findSummary(context.userId, dayKey);
  return existing?.goal ?? context.profile.dailyGoal;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function toLogDto(log: WaterLog): WaterLogDto {
  return {
    id: log.id,
    amount: log.amount,
    loggedAt: log.loggedAt.toISOString(),
    source: log.source,
  };
}

export function toSummaryDto(summary: DailySummary): DaySummaryDto {
  return {
    date: summary.date,
    totalAmount: summary.totalAmount,
    goal: summary.goal,
    percentage: summary.percentage,
    goalCompleted: summary.goalCompleted,
    logCount: summary.logCount,
  };
}

export function toProfileDto(context: HydrationContext): HydrationProfileDto {
  const { profile } = context;
  return {
    weightKg: profile.weightKg,
    activityLevel: profile.activityLevel,
    climate: profile.climate,
    dailyGoal: profile.dailyGoal,
    goalIsCustom: profile.goalIsCustom,
    wakeTime: profile.wakeTime,
    sleepTime: profile.sleepTime,
    unit: profile.unit,
    defaultServing: profile.defaultServing,
  };
}

export function toSettingsDto(context: HydrationContext): ReminderSettingsDto {
  const { reminders } = context;
  return {
    enabled: reminders.enabled,
    interval: reminders.interval,
    startTime: reminders.startTime,
    endTime: reminders.endTime,
    quietHoursStart: reminders.quietHoursStart,
    quietHoursEnd: reminders.quietHoursEnd,
    adaptive: reminders.adaptive,
    soundEnabled: reminders.soundEnabled,
    soundBeeps: reminders.soundBeeps,
    soundTone: alertTone(reminders.soundTone).id,
    vibrationEnabled: reminders.vibrationEnabled,
  };
}

export function toReminderDto(
  plan: ReminderPlan,
  enabled: boolean,
  hourlyPattern: number[] | null = null,
  patternDays = 0,
): ReminderDto {
  return {
    state: plan.state,
    headline: plan.headline,
    body: plan.body,
    ctaLabel: plan.ctaLabel,
    suggestedAmount: plan.suggestedAmount,
    expected: plan.expected,
    deficit: plan.deficit,
    nextReminderAt: plan.nextReminderAt?.toISOString() ?? null,
    shouldNotify: plan.shouldNotify,
    minutesSinceLastDrink: plan.minutesSinceLastDrink,
    resting: plan.resting,
    enabled,
    hourlyPattern,
    patternDays,
  };
}

export type { StreakSummary };

// ---------------------------------------------------------------------------

function lastLogAt(logs: readonly WaterLog[]): Date | null {
  return logs.length > 0 ? (logs[logs.length - 1]?.loggedAt ?? null) : null;
}

function lastSevenDays(today: DayKey): DayKey[] {
  return Array.from({ length: 7 }, (_, index) => addDays(today, index - 6));
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function weekdayLabel(dayKey: DayKey): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  return WEEKDAY_SHORT[date.getUTCDay()] ?? "";
}

function greeting(context: HydrationContext): string {
  const hour = Math.floor(minutesOfDay(context.now, context.timezone) / 60);
  const firstName = context.name.trim().split(/\s+/)[0] ?? context.name;
  if (hour < 5) return `Still up, ${firstName}?`;
  if (hour < 12) return `Good morning, ${firstName}`;
  if (hour < 18) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
