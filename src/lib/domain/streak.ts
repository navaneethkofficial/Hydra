/**
 * Streaks and consistency.
 *
 * Consistency is the product's actual goal, so the maths is deliberately kind:
 * a day still in progress can never break a streak, and a missed day costs you
 * the streak but not the encouragement.
 */

import { addDays, type DayKey } from "./time";

export interface DayOutcome {
  date: DayKey;
  goalCompleted: boolean;
}

export interface StreakSummary {
  current: number;
  longest: number;
  /** Share of the last `window` days where the goal was reached, 0–100. */
  consistency: number;
  /** True when the streak is alive only because today is still open. */
  todayPending: boolean;
  /**
   * Yesterday was a day we have a record for, the goal wasn't reached, and
   * today is still open — the moment that earns a "fresh start" message.
   * False for a brand-new account, which has no yesterday to have missed.
   */
  freshStart: boolean;
}

/**
 * @param outcomes  Any order; only completed days matter.
 * @param today     The user's local day key.
 * @param window    Days to measure consistency over.
 */
export function computeStreaks(
  outcomes: readonly DayOutcome[],
  today: DayKey,
  window = 30,
): StreakSummary {
  const completed = new Set(
    outcomes.filter((outcome) => outcome.goalCompleted).map((outcome) => outcome.date),
  );
  // Days we have any record of, completed or not. Distinguishes "missed" from
  // "hasn't started yet".
  const recorded = new Set(outcomes.map((outcome) => outcome.date));

  const todayCompleted = completed.has(today);
  const yesterday = addDays(today, -1);
  // A day in progress is not a miss — start counting back from yesterday.
  let cursor = todayCompleted ? today : addDays(today, -1);
  let current = 0;
  while (completed.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  return {
    current,
    longest: Math.max(current, longestRun(completed)),
    consistency: consistencyOver(completed, today, window),
    todayPending: current > 0 && !todayCompleted,
    freshStart: !todayCompleted && recorded.has(yesterday) && !completed.has(yesterday),
  };
}

/** Longest run of consecutive completed days anywhere in history. */
function longestRun(completed: ReadonlySet<DayKey>): number {
  let longest = 0;
  for (const day of completed) {
    // Only start counting from the first day of a run, so this stays linear.
    if (completed.has(addDays(day, -1))) continue;
    let run = 0;
    let cursor = day;
    while (completed.has(cursor)) {
      run += 1;
      cursor = addDays(cursor, 1);
    }
    longest = Math.max(longest, run);
  }
  return longest;
}

function consistencyOver(completed: ReadonlySet<DayKey>, today: DayKey, window: number): number {
  if (window <= 0) return 0;
  let hits = 0;
  for (let offset = 0; offset < window; offset += 1) {
    if (completed.has(addDays(today, -offset))) hits += 1;
  }
  return Math.round((hits / window) * 100);
}

/**
 * Streak copy. A missed day gets a reset, never a scolding — this is the line
 * that decides whether the product feels like a companion or a critic.
 */
export function streakMessage(summary: StreakSummary): string {
  if (summary.current >= 7) return "A full week of consistency. That's the habit forming.";
  if (summary.current >= 3) return "Three days and counting. Consistency is the whole game.";
  if (summary.current > 0) return "Off to a good start. One day at a time.";
  if (summary.freshStart) return "Yesterday didn't go as planned. Today is a fresh start.";
  return "Log a drink today to start a streak.";
}
