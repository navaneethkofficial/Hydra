import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";

import { prisma } from "@/server/db";
import { authCookieOptions } from "./cookies";

/**
 * Session handling.
 *
 * Sessions are opaque random tokens in an httpOnly cookie, with only their
 * SHA-256 stored server side. That buys two things a stateless JWT does not:
 * a leaked database dump yields no usable tokens, and a session can be revoked
 * immediately on logout, password reset or account deletion.
 */

export const SESSION_COOKIE = "hydra_session";
const SESSION_TTL_DAYS = 30;
/** Only rewrite the cookie when it is over a day old — one write, not one per request. */
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  timezone: string;
  theme: "LIGHT" | "DARK" | "SYSTEM";
  onboardedAt: Date | null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      ip: meta.ip?.slice(0, 64) ?? null,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, { ...(await authCookieOptions()), expires: expiresAt });
}

/**
 * Resolves the signed-in user, or `null`.
 *
 * Wrapped in React `cache` so a page that checks auth in the layout, the page
 * and a service all share one query per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          timezone: true,
          theme: true,
          onboardedAt: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    // Expired rows are cleaned up lazily on the read that finds them.
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  if (Date.now() - session.lastSeenAt.getTime() > REFRESH_AFTER_MS) {
    await prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  return session.user;
});

/** Clears the current session, server side and in the browser. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

/** Signs every device out — used after a password change or reset. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
