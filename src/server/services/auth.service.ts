import "server-only";

import { fakeVerify, hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, destroyAllSessions } from "@/server/auth/session";
import { generateToken, hashToken } from "@/server/auth/tokens";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { badRequest, conflict, invalidCredentials } from "@/server/http/errors";
import * as userRepo from "@/server/repositories/user.repository";
import { safeTimeZone } from "@/lib/domain/time";
import type { UserDto } from "@/types/api";

/**
 * Registration, sign-in and password recovery.
 *
 * Two properties are load-bearing here:
 *  - responses never reveal whether an email address has an account;
 *  - every password change invalidates existing sessions.
 */

export interface AuthResult {
  user: UserDto;
  /** New accounts and half-finished ones are sent through onboarding. */
  needsOnboarding: boolean;
}

export async function register(
  input: { name: string; email: string; password: string; timezone?: string },
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<AuthResult> {
  const existing = await userRepo.findByEmail(input.email);
  if (existing) {
    // The address is already known to us, which the user can see for themselves
    // on the sign-in screen — so this one is safe to say plainly.
    throw conflict("An account with that email already exists.", {
      email: "That email is already registered. Try signing in.",
    });
  }

  const user = await userRepo.createUser({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    timezone: safeTimeZone(input.timezone),
  });

  await createSession(user.id, meta);
  return { user: toUserDto(user), needsOnboarding: true };
}

export async function login(
  input: { email: string; password: string; timezone?: string },
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<AuthResult> {
  const user = await userRepo.findByEmail(input.email);

  if (!user?.passwordHash) {
    // Burn comparable time so response latency cannot enumerate accounts.
    // Also reached by accounts created through Google, which have no password:
    // they get the same answer, and the login form points them at Google.
    await fakeVerify();
    throw invalidCredentials();
  }

  if (!(await verifyPassword(input.password, user.passwordHash))) {
    throw invalidCredentials();
  }

  // Keep the timezone current so day boundaries follow the user when they move.
  if (input.timezone && safeTimeZone(input.timezone) !== user.timezone) {
    await userRepo.updateUser(user.id, { timezone: safeTimeZone(input.timezone) });
  }

  await createSession(user.id, meta);
  return { user: toUserDto(user), needsOnboarding: user.onboardedAt === null };
}

/**
 * Starts a password reset.
 *
 * Always reports success. The returned link is `null` for an unknown address —
 * in production it is emailed rather than returned, and in development it is
 * logged so the flow is testable without a mail server.
 */
export async function requestPasswordReset(email: string): Promise<{ resetUrl: string | null }> {
  const user = await userRepo.findByEmail(email);
  if (!user) return { resetUrl: null };

  const { token, tokenHash, expiresAt } = generateToken();

  // One live reset link at a time.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

  const resetUrl = `${env.appUrl}/reset-password?token=${token}`;
  if (!env.isProduction) {
    console.info(`[auth] password reset link for ${user.email}: ${resetUrl}`);
  }
  // TODO: hand `resetUrl` to the transactional mail provider in production.

  return { resetUrl: env.isProduction ? null : resetUrl };
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    throw badRequest("That reset link has expired. Request a new one.");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(password) },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  // A reset is how someone recovers a compromised account: drop every session.
  await destroyAllSessions(record.userId);
}

/** Signs in via a verified OAuth identity, creating the account on first use. */
export async function signInWithOAuth(
  provider: string,
  profile: { providerAccountId: string; email: string; name: string; image?: string | null },
  meta: { userAgent?: string | null; ip?: string | null; timezone?: string } = {},
): Promise<AuthResult> {
  const linked = await userRepo.findOAuthAccount(provider, profile.providerAccountId);
  if (linked) {
    await createSession(linked.user.id, meta);
    return { user: toUserDto(linked.user), needsOnboarding: linked.user.onboardedAt === null };
  }

  // Same verified email as an existing account: link rather than fork the data.
  const existing = await userRepo.findByEmail(profile.email);
  if (existing) {
    await userRepo.linkOAuthAccount(existing.id, provider, profile.providerAccountId);
    if (!existing.image && profile.image) {
      await userRepo.updateUser(existing.id, { image: profile.image });
    }
    await createSession(existing.id, meta);
    return { user: toUserDto(existing), needsOnboarding: existing.onboardedAt === null };
  }

  const user = await userRepo.createUser({
    name: profile.name,
    email: profile.email,
    image: profile.image ?? null,
    passwordHash: null,
    timezone: safeTimeZone(meta.timezone),
  });
  await userRepo.linkOAuthAccount(user.id, provider, profile.providerAccountId);
  await createSession(user.id, meta);

  return { user: toUserDto(user), needsOnboarding: true };
}

function toUserDto(user: {
  id: string;
  name: string;
  email: string;
  image: string | null;
  timezone: string;
  theme: "LIGHT" | "DARK" | "SYSTEM";
  onboardedAt: Date | null;
}): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    timezone: user.timezone,
    theme: user.theme,
    onboarded: user.onboardedAt !== null,
  };
}
