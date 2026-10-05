/**
 * The API contract.
 *
 * Plain types with no server imports, so client components, the fetch wrapper
 * and (later) a mobile client can all depend on them without dragging Prisma
 * into the bundle. Timestamps cross the wire as ISO strings.
 */

import type { AlertToneId } from "@/lib/domain/alert";
import type { ActivityLevel, Climate } from "@/lib/domain/goal";
import type { ReminderState } from "@/lib/domain/reminder-engine";
import type { Unit } from "@/lib/domain/units";

export type Theme = "LIGHT" | "DARK" | "SYSTEM";
export type LogSource = "MANUAL" | "REMINDER" | "QUICK_ADD";

export interface UserDto {
  id: string;
  name: string;
  email: string;
  image: string | null;
  timezone: string;
  theme: Theme;
  onboarded: boolean;
}

export interface HydrationProfileDto {
  weightKg: number | null;
  activityLevel: ActivityLevel;
  climate: Climate;
  dailyGoal: number;
  goalIsCustom: boolean;
  wakeTime: string;
  sleepTime: string;
  unit: Unit;
  defaultServing: number;
}

export interface ReminderSettingsDto {
  enabled: boolean;
  interval: number;
  startTime: string;
  endTime: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  adaptive: boolean;
  soundEnabled: boolean;
  /** Alert length, in beeps. */
  soundBeeps: number;
  soundTone: AlertToneId;
  vibrationEnabled: boolean;
}

export interface WaterLogDto {
  id: string;
  amount: number;
  loggedAt: string;
  source: LogSource;
}

export interface ProgressDto {
  consumed: number;
  goal: number;
  percentage: number;
  rawPercentage: number;
  remaining: number;
  completed: boolean;
}

export interface StreakDto {
  current: number;
  longest: number;
  consistency: number;
  todayPending: boolean;
  freshStart: boolean;
  message: string;
  /** The last seven days, oldest first — the strip under the ring. */
  week: Array<{ date: string; label: string; completed: boolean; isToday: boolean; isFuture: boolean }>;
}

export interface ReminderDto {
  state: ReminderState;
  headline: string;
  body: string;
  ctaLabel: string;
  suggestedAmount: number;
  expected: number;
  deficit: number;
  nextReminderAt: string | null;
  shouldNotify: boolean;
  minutesSinceLastDrink: number | null;
  resting: boolean;
  enabled: boolean;
  /**
   * The hourly weights the server used, so the client can re-evaluate the plan
   * locally between fetches and reach the identical answer.
   */
  hourlyPattern: number[] | null;
  patternDays: number;
}

/** Everything the dashboard needs, in one request. */
export interface TodayDto {
  date: string;
  timezone: string;
  greeting: string;
  progress: ProgressDto;
  logs: WaterLogDto[];
  streak: StreakDto;
  reminder: ReminderDto;
  profile: HydrationProfileDto;
  settings: ReminderSettingsDto;
}

export interface DaySummaryDto {
  date: string;
  totalAmount: number;
  goal: number;
  percentage: number;
  goalCompleted: boolean;
  logCount: number;
}

export interface HistoryDto {
  from: string;
  to: string;
  timezone: string;
  unit: Unit;
  days: DaySummaryDto[];
  totals: {
    averageDaily: number;
    daysLogged: number;
    goalsReached: number;
    bestDay: DaySummaryDto | null;
  };
  streak: StreakDto;
}

export interface DayDetailDto {
  date: string;
  summary: DaySummaryDto | null;
  logs: WaterLogDto[];
}

export interface InsightDto {
  id: string;
  icon: string;
  title: string;
}

export interface InsightsDto {
  timezone: string;
  unit: Unit;
  rangeDays: number;
  /** Current calendar week, Monday first. */
  week: Array<{ date: string; label: string; percentage: number; totalAmount: number; goal: number; isToday: boolean; isFuture: boolean }>;
  /** Millilitres logged per hour of day, aggregated over the range. */
  hourly: number[];
  averageDaily: number;
  bestDay: DaySummaryDto | null;
  daysGoalReached: number;
  daysLogged: number;
  streak: StreakDto;
  insights: InsightDto[];
  /** False until there is enough history to say anything honest. */
  hasEnoughData: boolean;
}

export interface SettingsDto {
  user: UserDto;
  profile: HydrationProfileDto;
  reminders: ReminderSettingsDto;
  suggestedGoal: number;
  googleLinked: boolean;
  hasPassword: boolean;
}

export interface LogWaterResultDto {
  log: WaterLogDto;
  progress: ProgressDto;
  streak: StreakDto;
  reminder: ReminderDto;
  /** True when this drink is the one that completed the day. */
  goalJustCompleted: boolean;
}
