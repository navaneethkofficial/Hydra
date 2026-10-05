import "server-only";
import type { HydrationProfile, Prisma, ReminderSettings } from "@prisma/client";

import { prisma } from "@/server/db";

/**
 * Hydration profile and reminder preferences.
 *
 * Both are created alongside the user, so in practice these upserts always take
 * the update path; the create branch exists only to make the repository safe to
 * call for an account that predates a settings table.
 */

export type ProfilePatch = Prisma.HydrationProfileUncheckedUpdateInput;
export type ReminderPatch = Prisma.ReminderSettingsUncheckedUpdateInput;

export function findProfile(userId: string): Promise<HydrationProfile | null> {
  return prisma.hydrationProfile.findUnique({ where: { userId } });
}

export function upsertProfile(userId: string, data: ProfilePatch): Promise<HydrationProfile> {
  return prisma.hydrationProfile.upsert({
    where: { userId },
    create: { ...data, userId } as Prisma.HydrationProfileUncheckedCreateInput,
    update: data,
  });
}

export function findReminderSettings(userId: string): Promise<ReminderSettings | null> {
  return prisma.reminderSettings.findUnique({ where: { userId } });
}

export function upsertReminderSettings(
  userId: string,
  data: ReminderPatch,
): Promise<ReminderSettings> {
  return prisma.reminderSettings.upsert({
    where: { userId },
    create: { ...data, userId } as Prisma.ReminderSettingsUncheckedCreateInput,
    update: data,
  });
}
