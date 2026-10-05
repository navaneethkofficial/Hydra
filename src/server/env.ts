import "server-only";

import { parseSecureCookieMode } from "@/server/auth/cookie-policy";

/**
 * Environment access, validated once at module load.
 *
 * Failing here — loudly, at boot — beats discovering a missing secret when the
 * first user tries to log in.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

const authSecret = required("AUTH_SECRET");
if (process.env.NODE_ENV === "production" && authSecret.length < 32) {
  throw new Error("AUTH_SECRET must be at least 32 characters in production.");
}

const googleClientId = optional("GOOGLE_CLIENT_ID");
const googleClientSecret = optional("GOOGLE_CLIENT_SECRET");

export const env = {
  databaseUrl: required("DATABASE_URL"),
  authSecret,
  appUrl: optional("APP_URL") ?? "http://localhost:3000",
  isProduction: process.env.NODE_ENV === "production",
  /** `Secure` attribute policy for auth cookies; see `server/auth/cookie-policy.ts`. */
  authCookieSecure: parseSecureCookieMode(process.env.AUTH_COOKIE_SECURE),
  google:
    googleClientId && googleClientSecret
      ? { clientId: googleClientId, clientSecret: googleClientSecret }
      : null,
} as const;

/** Drives whether the UI offers "Continue with Google" at all. */
export const googleAuthEnabled = env.google !== null;
