/**
 * Behavioural insights.
 *
 * Observations about behaviour — never health claims, never diagnoses. Each
 * generator returns `null` when the data does not actually support the
 * statement, so the UI shows fewer, truer cards rather than filler.
 */

import { computeProgress } from "./progress";
import { addDays, isoWeekdayIndex, type DayKey } from "./time";

export interface DaySummaryLike {
  date: DayKey;
  totalAmount: number;
  goal: number;
  goalCompleted: boolean;
}

export interface Insight {
  id: string;
  icon: string;
  title: string;
  /** Higher sorts first. */
  weight: number;
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface InsightInputs {
  summaries: readonly DaySummaryLike[];
  /** Millilitres logged per hour of day, aggregated over the period. */
  hourlyTotals: readonly number[];
  today: DayKey;
}

/** The minimum history before we claim to have noticed a pattern. */
export const MIN_DAYS_FOR_INSIGHTS = 3;

export function generateInsights({ summaries, hourlyTotals, today }: InsightInputs): Insight[] {
  const withData = summaries.filter((day) => day.totalAmount > 0);
  if (withData.length < MIN_DAYS_FOR_INSIGHTS) return [];

  return [
    peakWindowInsight(hourlyTotals),
    weakestWeekdayInsight(withData),
    weekdayVsWeekendInsight(withData),
    eveningDropInsight(hourlyTotals),
    weeklyGoalCountInsight(summaries, today),
    trendInsight(summaries, today),
  ]
    .filter((insight): insight is Insight => insight !== null)
    .sort((a, b) => b.weight - a.weight);
}

/** "You drink most of your water between 9 AM and 1 PM." */
function peakWindowInsight(hourlyTotals: readonly number[]): Insight | null {
  const total = sum(hourlyTotals);
  if (total <= 0 || hourlyTotals.length !== 24) return null;

  let bestStart = 0;
  let bestShare = 0;
  for (let start = 0; start < 24; start += 1) {
    let windowTotal = 0;
    for (let offset = 0; offset < 4; offset += 1) {
      windowTotal += hourlyTotals[(start + offset) % 24] ?? 0;
    }
    if (windowTotal > bestShare) {
      bestShare = windowTotal;
      bestStart = start;
    }
  }

  const share = bestShare / total;
  // A flat day has no peak worth reporting: 4/24 hours is ~17% by chance.
  if (share < 0.35) return null;

  return {
    id: "peak-window",
    icon: "🧠",
    title: `You drink most of your water between ${hourLabel(bestStart)} and ${hourLabel((bestStart + 4) % 24)}.`,
    weight: 90,
  };
}

/** "Fridays are usually your lowest hydration days." */
function weakestWeekdayInsight(summaries: readonly DaySummaryLike[]): Insight | null {
  const byWeekday = groupByWeekday(summaries);
  const averages = byWeekday
    .map((values, index) => ({ index, count: values.length, average: mean(values) }))
    .filter((entry) => entry.count >= 2);

  if (averages.length < 4) return null;

  const overall = mean(averages.map((entry) => entry.average));
  const weakest = averages.reduce((low, entry) => (entry.average < low.average ? entry : low));
  if (overall <= 0 || weakest.average / overall > 0.8) return null;

  return {
    id: "weakest-weekday",
    icon: "💡",
    title: `${WEEKDAY_LABELS[weakest.index]}days are usually your lowest hydration days.`,
    weight: 80,
  };
}

/** "You're most consistent on weekdays." */
function weekdayVsWeekendInsight(summaries: readonly DaySummaryLike[]): Insight | null {
  const weekday: number[] = [];
  const weekend: number[] = [];
  for (const day of summaries) {
    (isoWeekdayIndex(day.date) >= 5 ? weekend : weekday).push(percentOf(day));
  }
  if (weekday.length < 3 || weekend.length < 2) return null;

  const weekdayAverage = mean(weekday);
  const weekendAverage = mean(weekend);
  const gap = Math.abs(weekdayAverage - weekendAverage);
  if (gap < 12) return null;

  return {
    id: "weekday-weekend",
    icon: "📊",
    title:
      weekdayAverage > weekendAverage
        ? "You're more consistent on weekdays than weekends."
        : "Your weekends are more consistent than your weekdays.",
    weight: 70,
  };
}

/** "Your hydration usually drops after 6 PM." */
function eveningDropInsight(hourlyTotals: readonly number[]): Insight | null {
  const total = sum(hourlyTotals);
  if (total <= 0 || hourlyTotals.length !== 24) return null;

  let evening = 0;
  for (let hour = 18; hour < 24; hour += 1) evening += hourlyTotals[hour] ?? 0;
  const share = evening / total;
  if (share > 0.12) return null;

  return {
    id: "evening-drop",
    icon: "📉",
    title: "Your hydration usually drops off after 6 PM.",
    weight: 60,
  };
}

/** "You've completed your goal 6 days this week." */
function weeklyGoalCountInsight(
  summaries: readonly DaySummaryLike[],
  today: DayKey,
): Insight | null {
  const window = new Set<DayKey>();
  for (let offset = 0; offset < 7; offset += 1) window.add(addDays(today, -offset));
  const hits = summaries.filter((day) => window.has(day.date) && day.goalCompleted).length;
  if (hits < 2) return null;

  return {
    id: "weekly-goal-count",
    icon: "🔥",
    title: `You've reached your goal ${hits} ${hits === 1 ? "day" : "days"} in the last week.`,
    weight: 95,
  };
}

/** "Your weekly consistency improved by 18%." */
function trendInsight(summaries: readonly DaySummaryLike[], today: DayKey): Insight | null {
  const byDate = new Map(summaries.map((day) => [day.date, day] as const));
  const slice = (from: number, to: number) => {
    const values: number[] = [];
    for (let offset = from; offset < to; offset += 1) {
      const day = byDate.get(addDays(today, -offset));
      if (day) values.push(percentOf(day));
    }
    return values;
  };

  const thisWeek = slice(0, 7);
  const lastWeek = slice(7, 14);
  if (thisWeek.length < 4 || lastWeek.length < 4) return null;

  const current = mean(thisWeek);
  const previous = mean(lastWeek);
  if (previous <= 0) return null;

  const change = Math.round(((current - previous) / previous) * 100);
  if (Math.abs(change) < 8) return null;

  return {
    id: "weekly-trend",
    icon: change > 0 ? "📈" : "🌱",
    title:
      change > 0
        ? `Your weekly consistency improved by ${change}%.`
        : "This week is a little quieter than last. Small sips add up.",
    weight: 85,
  };
}

// ---------------------------------------------------------------------------

function groupByWeekday(summaries: readonly DaySummaryLike[]): number[][] {
  const buckets: number[][] = Array.from({ length: 7 }, () => []);
  for (const day of summaries) {
    buckets[isoWeekdayIndex(day.date)]?.push(percentOf(day));
  }
  return buckets;
}

function percentOf(day: DaySummaryLike): number {
  return computeProgress(day.totalAmount, day.goal).percentage;
}

function hourLabel(hour: number): string {
  const suffix = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}
