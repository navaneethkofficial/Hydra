import "server-only";

import { clampDailyGoal, suggestDailyGoal } from "@/lib/domain/goal";
import { safeTimeZone } from "@/lib/domain/time";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { destroyAllSessions } from "@/server/auth/session";
import { badRequest, notFound } from "@/server/http/errors";
import * as settingsRepo from "@/server/repositories/settings.repository";
import * as userRepo from "@/server/repositories/user.repository";
import { loadContext } from "./context";
import { toProfileDto, toSettingsDto } from "./hydration.service";
import type { SettingsDto } from "@/types/api";
import type { OnboardingInput, UpdateSettingsInput } from "@/server/validation/schemas";

/**
 * Profile, hydration target and reminder preferences.
 *
 * Two rules shape this module: a goal the user typed is never silently
 * recalculated, and reminder hours follow the awake window unless the user has
 * said otherwise.
 */

export async function getSettings(userId: string, now = new Date()): Promise<SettingsDto> {
  const context = await loadContext(userId, now);
  const user = await userRepo.findById(userId);
  if (!user) throw notFound("We couldn't find your account.");

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      timezone: user.timezone,
      theme: user.theme,
      onboarded: user.onboardedAt !== null,
    },
    profile: toProfileDto(context),
    reminders: toSettingsDto(context),
    suggestedGoal: suggestDailyGoal({
      weightKg: context.profile.weightKg,
      activityLevel: context.profile.activityLevel,
      climate: context.profile.climate,
    }),
    googleLinked: await userRepo.hasOAuthAccount(userId, "google"),
    hasPassword: user.passwordHash !== null,
  };
}

/** Turns the four onboarding answers into a working setup. */
export async function completeOnboarding(
  userId: string,
  input: OnboardingInput,
  now = new Date(),
): Promise<SettingsDto> {
  const suggested = suggestDailyGoal({
    weightKg: input.weightKg ?? null,
    activityLevel: input.activityLevel,
    climate: input.climate,
  });
  const goalIsCustom = input.dailyGoal !== undefined && input.dailyGoal !== suggested;

  await settingsRepo.upsertProfile(userId, {
    weightKg: input.weightKg ?? null,
    activityLevel: input.activityLevel,
    climate: input.climate,
    wakeTime: input.wakeTime,
    sleepTime: input.sleepTime,
    unit: input.unit,
    dailyGoal: clampDailyGoal(input.dailyGoal ?? suggested),
    goalIsCustom,
  });

  // Reminder hours default to the awake window — one fewer question to answer.
  await settingsRepo.upsertReminderSettings(userId, {
    startTime: input.wakeTime,
    endTime: input.sleepTime,
    quietHoursStart: input.sleepTime,
    quietHoursEnd: input.wakeTime,
    ...(input.reminderInterval !== undefined && { interval: input.reminderInterval }),
  });

  await userRepo.updateUser(userId, {
    onboardedAt: new Date(),
    ...(input.timezone && { timezone: safeTimeZone(input.timezone) }),
  });

  return getSettings(userId, now);
}

export async function updateSettings(
  userId: string,
  input: UpdateSettingsInput,
  now = new Date(),
): Promise<SettingsDto> {
  const context = await loadContext(userId, now);

  if (input.profile) {
    const { name, theme, timezone, dailyGoal, ...profileFields } = input.profile;

    if (name !== undefined || theme !== undefined || timezone !== undefined) {
      await userRepo.updateUser(userId, {
        ...(name !== undefined && { name }),
        ...(theme !== undefined && { theme }),
        ...(timezone !== undefined && { timezone: safeTimeZone(timezone) }),
      });
    }

    const nextProfile: settingsRepo.ProfilePatch = { ...profileFields };

    if (dailyGoal !== undefined) {
      nextProfile.dailyGoal = clampDailyGoal(dailyGoal);
      nextProfile.goalIsCustom = true;
    } else if (hasGoalInputs(profileFields) && !context.profile.goalIsCustom) {
      // The user never overrode the target, so keep it in step with their body
      // and routine rather than leaving a stale number behind.
      nextProfile.dailyGoal = suggestDailyGoal({
        weightKg: profileFields.weightKg ?? context.profile.weightKg,
        activityLevel: profileFields.activityLevel ?? context.profile.activityLevel,
        climate: profileFields.climate ?? context.profile.climate,
      });
    }

    if (Object.keys(nextProfile).length > 0) {
      await settingsRepo.upsertProfile(userId, nextProfile);
    }
  }

  if (input.reminders) {
    if (
      input.reminders.startTime &&
      input.reminders.endTime &&
      input.reminders.startTime === input.reminders.endTime
    ) {
      throw badRequest("Reminder start and end times can't be the same.", {
        "reminders.endTime": "Pick a different end time.",
      });
    }
    await settingsRepo.upsertReminderSettings(userId, input.reminders);
  }

  return getSettings(userId, now);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await userRepo.findById(userId);
  if (!user) throw notFound("We couldn't find your account.");

  if (!user.passwordHash) {
    throw badRequest("This account signs in with Google. Use a password reset to add a password.");
  }
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw badRequest("That current password doesn't match.", {
      currentPassword: "That doesn't match your current password.",
    });
  }

  await userRepo.updateUser(userId, { passwordHash: await hashPassword(newPassword) });
  // Changing a password signs out every other device — that is the point of it.
  await destroyAllSessions(userId);
}

export async function deleteAccount(userId: string): Promise<void> {
  await userRepo.deleteUser(userId);
}

function hasGoalInputs(fields: Record<string, unknown>): boolean {
  return (
    fields.weightKg !== undefined ||
    fields.activityLevel !== undefined ||
    fields.climate !== undefined
  );
}
