import { z } from "zod";

import { MAX_DAILY_GOAL_ML, MIN_DAILY_GOAL_ML } from "@/lib/domain/goal";
import { isValidDayKey, isValidTimeOfDay, isValidTimeZone } from "@/lib/domain/time";
import { MAX_REMINDER_INTERVAL, MIN_REMINDER_INTERVAL } from "@/lib/domain/reminder-engine";
import { ALERT_TONE_IDS, MAX_ALERT_BEEPS, MIN_ALERT_BEEPS } from "@/lib/domain/alert";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

/**
 * The validation contract, shared by the API routes and the client forms.
 *
 * One definition per concept means a rule can never drift between the button
 * that submits and the endpoint that accepts. Messages are user-facing copy.
 */

export const timeOfDaySchema = z
  .string()
  .refine(isValidTimeOfDay, { message: "Use a time like 07:30." });

export const dayKeySchema = z
  .string()
  .refine(isValidDayKey, { message: "Use a date like 2026-09-07." });

export const timezoneSchema = z
  .string()
  .max(64)
  .refine(isValidTimeZone, { message: "We didn't recognise that timezone." });

export const activityLevelSchema = z.enum(["LOW", "MODERATE", "ACTIVE", "VERY_ACTIVE"]);
export const climateSchema = z.enum(["TEMPERATE", "WARM", "HOT"]);
export const unitSchema = z.enum(["ML", "OZ"]);
export const themeSchema = z.enum(["LIGHT", "DARK", "SYSTEM"]);
export const logSourceSchema = z.enum(["MANUAL", "REMINDER", "QUICK_ADD"]);

// --- Auth -------------------------------------------------------------------

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .max(254)
  .email("That doesn't look like an email address.")
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(MAX_PASSWORD_LENGTH, "That password is too long.");

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Tell us what to call you.").max(60),
  email: emailSchema,
  password: passwordSchema,
  timezone: timezoneSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
  timezone: timezoneSchema.optional(),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "This reset link looks incomplete."),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: passwordSchema,
});

// --- Onboarding & settings --------------------------------------------------

export const onboardingSchema = z
  .object({
    weightKg: z.number().min(20, "That seems low.").max(400, "That seems high.").nullish(),
    activityLevel: activityLevelSchema.default("MODERATE"),
    climate: climateSchema.default("TEMPERATE"),
    wakeTime: timeOfDaySchema.default("07:00"),
    sleepTime: timeOfDaySchema.default("23:00"),
    unit: unitSchema.default("ML"),
    dailyGoal: z.number().int().min(MIN_DAILY_GOAL_ML).max(MAX_DAILY_GOAL_ML).optional(),
    reminderInterval: z.number().int().min(MIN_REMINDER_INTERVAL).max(MAX_REMINDER_INTERVAL).optional(),
    timezone: timezoneSchema.optional(),
  })
  .refine((value) => value.wakeTime !== value.sleepTime, {
    message: "Your wake and sleep times can't be the same.",
    path: ["sleepTime"],
  });

export const updateSettingsSchema = z
  .object({
    profile: z
      .object({
        name: z.string().trim().min(1, "Tell us what to call you.").max(60).optional(),
        weightKg: z.number().min(20).max(400).nullish(),
        activityLevel: activityLevelSchema.optional(),
        climate: climateSchema.optional(),
        dailyGoal: z.number().int().min(MIN_DAILY_GOAL_ML).max(MAX_DAILY_GOAL_ML).optional(),
        defaultServing: z.number().int().min(50).max(2000).optional(),
        unit: unitSchema.optional(),
        wakeTime: timeOfDaySchema.optional(),
        sleepTime: timeOfDaySchema.optional(),
        timezone: timezoneSchema.optional(),
        theme: themeSchema.optional(),
      })
      .optional(),
    reminders: z
      .object({
        enabled: z.boolean().optional(),
        interval: z
          .number()
          .int()
          .min(MIN_REMINDER_INTERVAL, `${MIN_REMINDER_INTERVAL} minute${MIN_REMINDER_INTERVAL === 1 ? "" : "s"} is the shortest gap.`)
          .max(MAX_REMINDER_INTERVAL)
          .optional(),
        startTime: timeOfDaySchema.optional(),
        endTime: timeOfDaySchema.optional(),
        quietHoursStart: timeOfDaySchema.optional(),
        quietHoursEnd: timeOfDaySchema.optional(),
        adaptive: z.boolean().optional(),
        soundEnabled: z.boolean().optional(),
        soundBeeps: z
          .number()
          .int("Use a whole number of beeps.")
          .min(MIN_ALERT_BEEPS, "At least one beep.")
          .max(MAX_ALERT_BEEPS, `${MAX_ALERT_BEEPS} beeps is the longest alert.`)
          .optional(),
        // Derived from the tone table, so adding a tone needs no schema edit.
        soundTone: z.enum(ALERT_TONE_IDS as [string, ...string[]]).optional(),
        vibrationEnabled: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((value) => value.profile !== undefined || value.reminders !== undefined, {
    message: "Nothing to update.",
  });

// --- Hydration --------------------------------------------------------------

/** A single serving. The ceiling is a typo guard, not a judgement. */
export const logWaterSchema = z.object({
  amount: z
    .number()
    .int("Use a whole number.")
    .min(10, "That's a little small — try at least 10 ml.")
    .max(3000, "That's a lot for one drink. Try logging it in a few goes."),
  source: logSourceSchema.default("QUICK_ADD"),
  /** Client timestamp, so a drink queued offline lands at the time it happened. */
  loggedAt: z.iso.datetime({ offset: true }).optional(),
  /** Idempotency key — makes an offline replay safe to retry. */
  clientId: z.string().min(8).max(64).optional(),
});

/** Offline queue flush: several drinks in one round trip. */
export const logWaterBatchSchema = z.object({
  entries: z.array(logWaterSchema).min(1).max(50),
});

export const historyQuerySchema = z.object({
  from: dayKeySchema.optional(),
  to: dayKeySchema.optional(),
  days: z.coerce.number().int().min(1).max(370).optional(),
});

export const insightsQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(120).default(28),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1024),
  keys: z.object({ p256dh: z.string().min(1).max(255), auth: z.string().min(1).max(255) }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type LogWaterInput = z.infer<typeof logWaterSchema>;
