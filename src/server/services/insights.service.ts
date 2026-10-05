import "server-only";

import { generateInsights, MIN_DAYS_FOR_INSIGHTS } from "@/lib/domain/insights";
import { addDays, eachDay, startOfWeek, type DayKey } from "@/lib/domain/time";
import * as hydrationRepo from "@/server/repositories/hydration.repository";
import { loadContext } from "./context";
import { buildStreak, learnHourlyPattern, toSummaryDto } from "./hydration.service";
import type { DaySummaryDto, InsightsDto } from "@/types/api";

/**
 * Weekly and behavioural insights.
 *
 * The service gathers data and the pure `insights` domain module decides what,
 * if anything, is worth saying. When there is not enough history the answer is
 * an honest "not yet" — better an empty state than a confident guess.
 */

export async function getInsights(
  userId: string,
  rangeDays = 28,
  now = new Date(),
): Promise<InsightsDto> {
  const context = await loadContext(userId, now);

  const from = addDays(context.today, -(rangeDays - 1));
  const [summaries, pattern] = await Promise.all([
    hydrationRepo.listSummaries(context.userId, from, context.today),
    learnHourlyPattern(context),
  ]);

  const dtos = summaries.map(toSummaryDto);
  const byDate = new Map(dtos.map((day) => [day.date, day] as const));
  const logged = dtos.filter((day) => day.totalAmount > 0);

  const bestDay = logged.reduce<DaySummaryDto | null>(
    (best, day) => (!best || day.totalAmount > best.totalAmount ? day : best),
    null,
  );

  return {
    timezone: context.timezone,
    unit: context.profile.unit,
    rangeDays,
    week: buildWeek(context.today, byDate, context.profile.dailyGoal),
    hourly: pattern.totals,
    averageDaily: logged.length
      ? Math.round(logged.reduce((sum, day) => sum + day.totalAmount, 0) / logged.length)
      : 0,
    bestDay,
    daysGoalReached: dtos.filter((day) => day.goalCompleted).length,
    daysLogged: logged.length,
    streak: await buildStreak(context),
    insights: generateInsights({
      summaries: dtos,
      hourlyTotals: pattern.totals,
      today: context.today,
    }).map(({ id, icon, title }) => ({ id, icon, title })),
    hasEnoughData: logged.length >= MIN_DAYS_FOR_INSIGHTS,
  };
}

/** The current calendar week, Monday first, with future days marked as such. */
function buildWeek(
  today: DayKey,
  byDate: ReadonlyMap<string, DaySummaryDto>,
  currentGoal: number,
): InsightsDto["week"] {
  const monday = startOfWeek(today);
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return eachDay(monday, addDays(monday, 6)).map((date, index) => {
    const summary = byDate.get(date);
    return {
      date,
      label: labels[index] ?? "",
      percentage: summary?.percentage ?? 0,
      totalAmount: summary?.totalAmount ?? 0,
      goal: summary?.goal ?? currentGoal,
      isToday: date === today,
      isFuture: date > today,
    };
  });
}
