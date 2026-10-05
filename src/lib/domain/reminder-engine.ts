/**
 * The reminder engine — the part of Hydra that earns "without having to
 * remember".
 *
 * It is explicitly *not* `setInterval(notify, 2h)`. Every nudge is derived from
 * where the user actually is against their own pace, and it stays quiet when
 * being quiet is the right answer: asleep, in quiet hours, already on track, or
 * two minutes after a drink.
 *
 * Pure and deterministic — same inputs, same plan. That makes it unit-testable
 * and lets the client re-evaluate it locally between server reads, so the
 * dashboard countdown keeps ticking offline.
 */

import { expectedByNow, blendHourlyWeights, paceWindow } from "./pace";
import {
  MINUTES_PER_DAY,
  isWithinWindow,
  minutesOfDay,
  parseTimeOfDay,
  toDayKey,
  windowLength,
  zonedTimeToInstant,
} from "./time";
import { roundToServing } from "./units";

export type ReminderState =
  | "RESTING"
  | "ON_TRACK"
  | "FALLING_BEHIND"
  | "INACTIVE"
  | "GOAL_MET";

export interface ReminderPreferences {
  enabled: boolean;
  /** Baseline minutes between nudges. The engine tightens or relaxes it. */
  interval: number;
  startTime: string;
  endTime: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  adaptive: boolean;
}

export interface ReminderContext {
  now: Date;
  timezone: string;
  goal: number;
  consumed: number;
  lastDrinkAt: Date | null;
  /** When the last reminder actually fired, so the next one counts from it. */
  lastReminderAt?: Date | null;
  /** Awake window, local `HH:mm`. */
  wakeTime: string;
  sleepTime: string;
  defaultServing: number;
  preferences: ReminderPreferences;
  /** 24 relative weights learned from history, if we have enough of it. */
  hourlyPattern?: readonly number[] | null;
  patternDays?: number;
}

export interface ReminderPlan {
  state: ReminderState;
  /** Millilitres the pace curve expects by now. */
  expected: number;
  /** How far behind that curve the user is, in millilitres (never negative). */
  deficit: number;
  /** consumed ÷ expected, capped for display sanity. */
  paceRatio: number;
  headline: string;
  body: string;
  ctaLabel: string;
  /** Suggested pour for the CTA, in millilitres. */
  suggestedAmount: number;
  nextReminderAt: Date | null;
  /** Whether reminders should fire at all right now (enabled, awake, goal not met). */
  shouldNotify: boolean;
  minutesSinceLastDrink: number | null;
  /** True while the user is outside their awake window or in quiet hours. */
  resting: boolean;
}

/** Shortest and longest reminder gap a user can choose, in minutes. */
export const MIN_REMINDER_INTERVAL = 1;
export const MAX_REMINDER_INTERVAL = 240;

/** Below this ratio against the pace curve we call it "falling behind". */
const BEHIND_RATIO = 0.75;
/** …but only if the gap is big enough to be worth a nudge at all. */
const BEHIND_MIN_DEFICIT_ML = 200;
/** Never nudge within this long of a drink — the user just handled it. */
const POST_DRINK_SNOOZE_MIN = 1;
/** Floor and ceiling on suggested pours, so the CTA stays realistic. */
const MIN_SUGGESTION_ML = 100;
const MAX_SUGGESTION_ML = 600;

export function evaluateReminder(context: ReminderContext): ReminderPlan {
  const {
    now,
    timezone,
    goal,
    consumed,
    lastDrinkAt,
    defaultServing,
    preferences,
  } = context;

  const nowMinute = minutesOfDay(now, timezone);
  const wakeMinute = parseTimeOfDay(context.wakeTime, 7 * 60);
  const sleepMinute = parseTimeOfDay(context.sleepTime, 23 * 60);
  const window = paceWindow(wakeMinute, sleepMinute);

  const weights = preferences.adaptive
    ? blendHourlyWeights(context.hourlyPattern, context.patternDays ?? 0)
    : undefined;

  const expected = expectedByNow(nowMinute, goal, window, weights);
  const deficit = Math.max(0, expected - consumed);
  const paceRatio = expected > 0 ? Math.min(2, consumed / expected) : consumed > 0 ? 1 : 0;

  const minutesSinceLastDrink = lastDrinkAt
    ? Math.max(0, Math.round((now.getTime() - lastDrinkAt.getTime()) / 60_000))
    : null;

  const awake = isWithinWindow(nowMinute, wakeMinute, sleepMinute);
  const inQuietHours = isWithinWindow(
    nowMinute,
    parseTimeOfDay(preferences.quietHoursStart, 22 * 60),
    parseTimeOfDay(preferences.quietHoursEnd, 7 * 60),
  );
  const inReminderWindow = isWithinWindow(
    nowMinute,
    parseTimeOfDay(preferences.startTime, wakeMinute),
    parseTimeOfDay(preferences.endTime, sleepMinute),
  );
  const resting = !awake || inQuietHours || !inReminderWindow;

  const state = resolveState({
    goal,
    consumed,
    resting,
    deficit,
    paceRatio,
    minutesSinceLastDrink,
    nowMinute,
    wakeMinute,
    interval: preferences.interval,
  });

  const suggestedAmount = suggestAmount({
    state,
    goal,
    consumed,
    deficit,
    defaultServing,
    nowMinute,
    window: { startMinute: window.startMinute, endMinute: window.endMinute },
    interval: preferences.interval,
  });

  const copy = COPY[state];

  return {
    state,
    expected,
    deficit,
    paceRatio,
    headline: copy.headline,
    body: copy.body({ deficit, consumed, goal, minutesSinceLastDrink }),
    ctaLabel: copy.cta,
    suggestedAmount,
    nextReminderAt: computeNextReminderAt(context, state),
    // Every scheduled reminder rings — the countdown on screen is a promise.
    shouldNotify: preferences.enabled && !resting && state !== "GOAL_MET",
    minutesSinceLastDrink,
    resting,
  };
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface StateInputs {
  goal: number;
  consumed: number;
  resting: boolean;
  deficit: number;
  paceRatio: number;
  minutesSinceLastDrink: number | null;
  nowMinute: number;
  wakeMinute: number;
  interval: number;
}

function resolveState(input: StateInputs): ReminderState {
  // Finishing the day's target outranks everything, including quiet hours.
  if (input.goal > 0 && input.consumed >= input.goal) return "GOAL_MET";
  if (input.resting) return "RESTING";

  const inactiveThreshold = Math.max(input.interval * 2, 150);
  const minutesAwake = ((input.nowMinute - input.wakeMinute) % MINUTES_PER_DAY + MINUTES_PER_DAY) % MINUTES_PER_DAY;

  if (input.minutesSinceLastDrink === null) {
    // Nothing logged yet today — only counts as inactive once genuinely late.
    return minutesAwake >= inactiveThreshold ? "INACTIVE" : "ON_TRACK";
  }

  if (input.minutesSinceLastDrink >= inactiveThreshold) return "INACTIVE";
  if (input.paceRatio < BEHIND_RATIO && input.deficit >= BEHIND_MIN_DEFICIT_ML) {
    return "FALLING_BEHIND";
  }

  return "ON_TRACK";
}

// ---------------------------------------------------------------------------
// Suggested amount
// ---------------------------------------------------------------------------

interface SuggestInputs {
  state: ReminderState;
  goal: number;
  consumed: number;
  deficit: number;
  defaultServing: number;
  nowMinute: number;
  window: { startMinute: number; endMinute: number };
  interval: number;
}

/**
 * Splits what is left across the nudges that still fit in the day, so the ask
 * stays small and achievable instead of "drink 1.2 L now".
 */
function suggestAmount(input: SuggestInputs): number {
  if (input.state === "GOAL_MET") return input.defaultServing;

  const remaining = Math.max(0, input.goal - input.consumed);
  if (remaining <= 0) return input.defaultServing;

  const minutesLeft = Math.max(
    0,
    windowLength(input.window.startMinute, input.window.endMinute) -
      ((input.nowMinute - input.window.startMinute + MINUTES_PER_DAY) % MINUTES_PER_DAY),
  );
  const slots = Math.max(1, Math.ceil(minutesLeft / Math.max(MIN_REMINDER_INTERVAL, input.interval)));
  const perSlot = remaining / slots;

  // When behind, lean on the larger of "catch-up share" and the usual serving.
  const behind = input.state === "FALLING_BEHIND" || input.state === "INACTIVE";
  const raw = behind ? Math.max(perSlot, input.defaultServing) : perSlot;

  return clamp(roundToServing(raw, 50), MIN_SUGGESTION_ML, Math.min(MAX_SUGGESTION_ML, Math.max(remaining, MIN_SUGGESTION_ML)));
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

/**
 * When the next nudge should land. Tightens the gap when the user is behind,
 * relaxes it when they are ahead, always respects quiet hours, and never fires
 * on the heels of a drink the user just logged.
 */
function computeNextReminderAt(context: ReminderContext, state: ReminderState): Date | null {
  const { now, timezone, preferences } = context;
  if (!preferences.enabled) return null;
  // The day's work is done; the next nudge belongs to tomorrow's window.
  if (state === "GOAL_MET") return null;

  const baseInterval = Math.max(MIN_REMINDER_INTERVAL, preferences.interval);
  const scale =
    state === "INACTIVE" ? 0.5 : state === "FALLING_BEHIND" ? 0.6 : 1;
  const interval = Math.max(MIN_REMINDER_INTERVAL, Math.round(baseInterval * scale));

  // Count from whichever happened last: a drink, a reminder, or the start of
  // today's reminder window — so a reminder that just fired pushes the next one
  // out, and a day with no drinks yet still has a moment that arrives.
  const windowStart = parseTimeOfDay(preferences.startTime, parseTimeOfDay(context.wakeTime, 8 * 60));
  const minutesSinceWindowStart =
    (minutesOfDay(now, timezone) - windowStart + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const anchor = new Date(
    Math.max(
      now.getTime() - minutesSinceWindowStart * 60_000,
      context.lastDrinkAt?.getTime() ?? 0,
      context.lastReminderAt?.getTime() ?? 0,
    ),
  );
  let candidate = new Date(anchor.getTime() + interval * 60_000);

  // Never sooner than a short breather after the last drink, or after now.
  const floor = context.lastDrinkAt
    ? Math.max(now.getTime(), context.lastDrinkAt.getTime() + POST_DRINK_SNOOZE_MIN * 60_000)
    : now.getTime();
  if (candidate.getTime() < floor) candidate = new Date(floor);

  return shiftIntoWindow(candidate, timezone, preferences);
}

/**
 * Walks a candidate instant forward until it lands inside the reminder window
 * and outside quiet hours. Bounded — a pathological config resolves to `null`
 * rather than spinning.
 */
function shiftIntoWindow(
  candidate: Date,
  timezone: string,
  preferences: ReminderPreferences,
): Date | null {
  const startMinute = parseTimeOfDay(preferences.startTime, 8 * 60);
  const endMinute = parseTimeOfDay(preferences.endTime, 22 * 60);
  const quietStart = parseTimeOfDay(preferences.quietHoursStart, 22 * 60);
  const quietEnd = parseTimeOfDay(preferences.quietHoursEnd, 7 * 60);

  if (windowLength(startMinute, endMinute) <= 0) return null;

  let cursor = candidate;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const minute = minutesOfDay(cursor, timezone);
    const dayKey = toDayKey(cursor, timezone);

    if (!isWithinWindow(minute, startMinute, endMinute)) {
      cursor = nextOccurrence(cursor, dayKey, minute, startMinute, timezone);
      continue;
    }
    if (isWithinWindow(minute, quietStart, quietEnd)) {
      cursor = nextOccurrence(cursor, dayKey, minute, quietEnd, timezone);
      continue;
    }
    return cursor;
  }

  return null;
}

/** The next instant at local `targetMinute`, at or after `from`. */
function nextOccurrence(
  from: Date,
  dayKey: string,
  currentMinute: number,
  targetMinute: number,
  timezone: string,
): Date {
  const today = zonedTimeToInstant(dayKey, targetMinute, timezone);
  if (today.getTime() > from.getTime() && targetMinute > currentMinute) return today;
  const tomorrow = zonedTimeToInstant(shiftDayKey(dayKey, 1), targetMinute, timezone);
  return tomorrow.getTime() > from.getTime() ? tomorrow : new Date(from.getTime() + 60 * 60_000);
}

function shiftDayKey(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
  return shifted.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Copy
//
// Tone rules, applied literally: friendly, encouraging, never judgemental.
// No message in here blames the user for a number.
// ---------------------------------------------------------------------------

interface CopyInputs {
  deficit: number;
  consumed: number;
  goal: number;
  minutesSinceLastDrink: number | null;
}

const COPY: Record<
  ReminderState,
  { headline: string; cta: string; body: (input: CopyInputs) => string }
> = {
  ON_TRACK: {
    headline: "You're on track",
    cta: "Log a drink",
    body: () => "Nice pace. Keep the glass within reach.",
  },
  FALLING_BEHIND: {
    headline: "You're falling a little behind",
    cta: "Take a sip",
    body: () => "A small top-up now puts you right back on pace.",
  },
  INACTIVE: {
    headline: "Haven't had water in a while?",
    cta: "Take a sip",
    body: ({ minutesSinceLastDrink }) =>
      minutesSinceLastDrink === null
        ? "Your first drink of the day is a good place to start."
        : `It's been about ${formatGap(minutesSinceLastDrink)} since your last drink.`,
  },
  GOAL_MET: {
    headline: "Daily goal complete",
    cta: "Log another",
    body: () => "You stayed consistent today. Anything more is a bonus.",
  },
  RESTING: {
    headline: "Resting for now",
    cta: "Log a drink",
    body: () => "Reminders are paused outside your usual hours.",
  },
};

function formatGap(minutes: number): string {
  if (minutes < 90) return `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
