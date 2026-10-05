import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Single-use tokens for password reset links.
 *
 * The raw token is only ever handed to the user (via the reset link); the
 * database keeps its hash, so a database read cannot be turned into a reset.
 */

export const RESET_TOKEN_TTL_MINUTES = 30;

export function generateToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000),
  };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokensMatch(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}
