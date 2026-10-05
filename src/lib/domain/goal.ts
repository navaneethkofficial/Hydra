/**
 * Daily target suggestion.
 *
 * This is a *general hydration target* to make the habit concrete — a starting
 * number the user can change at any time. It is deliberately not personalised
 * medical advice, and the copy in the UI says so.
 */

import { roundToServing } from "./units";

export type ActivityLevel = "LOW" | "MODERATE" | "ACTIVE" | "VERY_ACTIVE";
export type Climate = "TEMPERATE" | "WARM" | "HOT";

export const MIN_DAILY_GOAL_ML = 1000;
export const MAX_DAILY_GOAL_ML = 6000;
export const DEFAULT_DAILY_GOAL_ML = 2500;

/** Extra millilitres for movement across the day. */
const ACTIVITY_BONUS_ML: Record<ActivityLevel, number> = {
  LOW: 0,
  MODERATE: 300,
  ACTIVE: 600,
  VERY_ACTIVE: 900,
};

const CLIMATE_MULTIPLIER: Record<Climate, number> = {
  TEMPERATE: 1,
  WARM: 1.08,
  HOT: 1.15,
};

export interface GoalInputs {
  /** Body weight in kilograms. Optional — we fall back to a sensible default. */
  weightKg?: number | null;
  activityLevel?: ActivityLevel;
  climate?: Climate;
}

/**
 * ~33 ml per kilogram of body weight, nudged for activity and climate, then
 * rounded to a number a person can actually picture.
 */
export function suggestDailyGoal({
  weightKg,
  activityLevel = "MODERATE",
  climate = "TEMPERATE",
}: GoalInputs): number {
  if (!weightKg || !Number.isFinite(weightKg) || weightKg <= 0) {
    return clampDailyGoal(DEFAULT_DAILY_GOAL_ML + ACTIVITY_BONUS_ML[activityLevel]);
  }

  const base = weightKg * 33;
  const withActivity = base + ACTIVITY_BONUS_ML[activityLevel];
  const withClimate = withActivity * CLIMATE_MULTIPLIER[climate];

  return clampDailyGoal(roundToServing(withClimate, 100));
}

export function clampDailyGoal(ml: number): number {
  if (!Number.isFinite(ml)) return DEFAULT_DAILY_GOAL_ML;
  return Math.min(MAX_DAILY_GOAL_ML, Math.max(MIN_DAILY_GOAL_ML, Math.round(ml)));
}
