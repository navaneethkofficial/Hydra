import "server-only";
import type { HydrationProfile, ReminderSettings } from "@prisma/client";

import { notFound } from "@/server/http/errors";
import * as settingsRepo from "@/server/repositories/settings.repository";
import * as userRepo from "@/server/repositories/user.repository";
import { safeTimeZone, toDayKey, type DayKey } from "@/lib/domain/time";

/**
 * The bundle of user state every hydration operation needs: who they are, what
 * their target is, and what "today" means where they are standing.
 *
 * Loaded once per request and threaded through the services, so a single
 * dashboard render does not re-read the same three rows five times.
 */

export interface HydrationContext {
  userId: string;
  name: string;
  timezone: string;
  /** The user's local calendar day, right now. */
  today: DayKey;
  now: Date;
  profile: HydrationProfile;
  reminders: ReminderSettings;
}

export async function loadContext(userId: string, now = new Date()): Promise<HydrationContext> {
  const user = await userRepo.findWithSettings(userId);
  if (!user) throw notFound("We couldn't find your account.");

  // Self-heal rather than fail: an account is still usable if a settings row is
  // missing, and the defaults here match the schema defaults exactly.
  const profile = user.profile ?? (await settingsRepo.upsertProfile(userId, {}));
  const reminders = user.reminderSettings ?? (await settingsRepo.upsertReminderSettings(userId, {}));
  const timezone = safeTimeZone(user.timezone);

  return {
    userId,
    name: user.name,
    timezone,
    today: toDayKey(now, timezone),
    now,
    profile,
    reminders,
  };
}
