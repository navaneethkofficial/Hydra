/**
 * Expected pace across the day.
 *
 * A flat "goal ÷ hours awake" line is wrong for real people: it expects water
 * the minute you wake up and it keeps expecting more while you are winding down
 * for bed. So pace is a *curve* — weighted by hour of day, learned from the
 * user's own history once there is enough of it, and finishing before bedtime.
 */

import { MINUTES_PER_DAY, isWithinWindow, minutesIntoWindow, windowLength } from "./time";

/**
 * Population-level shape: a gentle ramp after waking, a plateau through the
 * working day, a taper into the evening. Values are relative weights per hour.
 */
export const DEFAULT_HOURLY_WEIGHTS: readonly number[] = [
  0.2, 0.2, 0.2, 0.2, 0.2, 0.3, 0.7, 1.0, 1.25, 1.35, 1.35, 1.2,
  1.15, 1.15, 1.1, 1.05, 1.0, 0.95, 0.85, 0.7, 0.55, 0.4, 0.3, 0.25,
];

/**
 * Drinking right up to bedtime is a bad trade for sleep, so the target curve
 * is designed to reach 100% this many minutes before the user's sleep time.
 */
export const PACE_FINISH_BUFFER_MIN = 60;

export interface PaceWindow {
  /** Minutes from local midnight where pacing starts (wake time). */
  startMinute: number;
  /** Minutes from local midnight where the curve reaches 100%. */
  endMinute: number;
}

/** The window the pace curve spans: waking until shortly before bed. */
export function paceWindow(wakeMinute: number, sleepMinute: number): PaceWindow {
  const awakeLength = windowLength(wakeMinute, sleepMinute);
  // Never shrink the window below four hours, however odd the configured times.
  const buffer = Math.min(PACE_FINISH_BUFFER_MIN, Math.max(0, awakeLength - 240));
  const endMinute = (((sleepMinute - buffer) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return { startMinute: wakeMinute, endMinute };
}

/**
 * Blends the population curve with the user's own hourly distribution.
 *
 * Confidence grows with observed days and tops out at 70% personal — we never
 * fully hand the curve over to history, or a single unusual week would lock the
 * user into it.
 */
export function blendHourlyWeights(
  observed: readonly number[] | null | undefined,
  observedDays: number,
): number[] {
  if (!observed || observed.length !== 24 || observedDays <= 0) {
    return [...DEFAULT_HOURLY_WEIGHTS];
  }

  const total = observed.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (total <= 0) return [...DEFAULT_HOURLY_WEIGHTS];

  const confidence = Math.min(1, observedDays / 14) * 0.7;
  const normalised = observed.map((value) => (Math.max(0, value) / total) * 24);

  return DEFAULT_HOURLY_WEIGHTS.map((base, hour) => {
    const personal = normalised[hour] ?? base;
    // Floor keeps a quiet hour from becoming a hard zero in the curve.
    return Math.max(0.05, base * (1 - confidence) + personal * confidence);
  });
}

/**
 * Fraction of the daily goal a user would have drunk by `minuteOfDay` if they
 * followed the curve exactly. Returns 0 before waking and 1 after the window.
 */
export function expectedFraction(
  minuteOfDay: number,
  window: PaceWindow,
  weights: readonly number[] = DEFAULT_HOURLY_WEIGHTS,
): number {
  const span = windowLength(window.startMinute, window.endMinute);
  if (span <= 0) return 1;

  if (!isWithinWindow(minuteOfDay, window.startMinute, window.endMinute)) {
    return outsideWindowFraction(minuteOfDay, window);
  }

  const elapsed = minutesIntoWindow(minuteOfDay, window.startMinute, window.endMinute);
  if (elapsed <= 0) return 0;
  if (elapsed >= span) return 1;

  const cumulative = integrateWeights(window.startMinute, elapsed, weights);
  const total = integrateWeights(window.startMinute, span, weights);
  if (total <= 0) return elapsed / span;

  return Math.min(1, cumulative / total);
}

/**
 * What to expect while the curve is not running.
 *
 * Before waking the day has not started, so nothing is expected yet; after the
 * curve completes but before bed the target has been fully asked for. For a
 * wrapping window — someone whose day starts at 22:00 — "before" and "after"
 * are decided by whichever edge of the off-window gap is nearer.
 */
function outsideWindowFraction(minuteOfDay: number, window: PaceWindow): number {
  if (window.startMinute < window.endMinute) {
    return minuteOfDay < window.startMinute ? 0 : 1;
  }
  const sinceEnd = (minuteOfDay - window.endMinute + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const untilStart = (window.startMinute - minuteOfDay + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return untilStart <= sinceEnd ? 0 : 1;
}

/** Millilitres the curve expects by now. */
export function expectedByNow(
  minuteOfDay: number,
  goal: number,
  window: PaceWindow,
  weights?: readonly number[],
): number {
  return Math.round(goal * expectedFraction(minuteOfDay, window, weights));
}

/**
 * Area under the hourly weight curve for `length` minutes starting at
 * `startMinute`, handling partial hours and midnight wrap.
 */
function integrateWeights(
  startMinute: number,
  length: number,
  weights: readonly number[],
): number {
  let area = 0;
  let cursor = startMinute;
  let left = length;

  while (left > 0) {
    const normalised = ((cursor % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    const hour = Math.floor(normalised / 60);
    const minutesLeftInHour = 60 - (normalised % 60);
    const step = Math.min(minutesLeftInHour, left);
    area += (weights[hour] ?? 1) * step;
    cursor += step;
    left -= step;
  }

  return area;
}
