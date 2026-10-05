/**
 * Daily progress maths.
 *
 * The one rule the UI depends on: `percentage` never exceeds 100, even though
 * people can and should keep logging past their target.
 */

export interface Progress {
  consumed: number;
  goal: number;
  /** Capped 0–100 — what the ring and bars render. */
  percentage: number;
  /** Uncapped 0–∞ — what "112% of your goal" copy reads from. */
  rawPercentage: number;
  /** Millilitres still to go; 0 once the goal is met. */
  remaining: number;
  completed: boolean;
}

export function computeProgress(consumed: number, goal: number): Progress {
  const safeGoal = goal > 0 ? goal : 1;
  const safeConsumed = Math.max(0, consumed);
  const ratio = safeConsumed / safeGoal;

  return {
    consumed: safeConsumed,
    goal: Math.max(0, goal),
    percentage: Math.min(100, Math.round(ratio * 100)),
    rawPercentage: Math.round(ratio * 100),
    remaining: Math.max(0, safeGoal - safeConsumed),
    completed: safeConsumed >= safeGoal,
  };
}
