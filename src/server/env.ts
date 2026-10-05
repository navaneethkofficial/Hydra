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

/**
 * The public base URL, used in OAuth redirects and reset links. On Vercel it
 * falls back to the project's production domain, so a deployment works before
 * APP_URL is set; set it anyway once a custom domain is attached.
 */
const vercelDomain = optional("VERCEL_PROJECT_PRODUCTION_URL");
const appUrl = (
  optional("APP_URL") ?? (vercelDomain ? `https://${vercelDomain}` : "http://localhost:3000")
).replace(/\/+$/, ""); // "https://x.app/" + "/login" must not become "//login"

/**
 * Shared rate-limit counters (see server/http/rate-limit.ts). Accepts Upstash's
 * own variable names and the KV_* names Vercel's Upstash integration sets.
 * Both URL and token must be present, or the in-memory limiter is used.
 */
const upstashUrl = optional("UPSTASH_REDIS_REST_URL") ?? optional("KV_REST_API_URL");
const upstashToken = optional("UPSTASH_REDIS_REST_TOKEN") ?? optional("KV_REST_API_TOKEN");

const googleClientId = optional("GOOGLE_CLIENT_ID");
const googleClientSecret = optional("GOOGLE_CLIENT_SECRET");

export const env = {
  databaseUrl: required("DATABASE_URL"),
  authSecret,
  appUrl,
  isProduction: process.env.NODE_ENV === "production",
  /** `Secure` attribute policy for auth cookies; see `server/auth/cookie-policy.ts`. */
  authCookieSecure: parseSecureCookieMode(process.env.AUTH_COOKIE_SECURE),
  upstash: upstashUrl && upstashToken ? { url: upstashUrl, token: upstashToken } : null,
  google:
    googleClientId && googleClientSecret
      ? { clientId: googleClientId, clientSecret: googleClientSecret }
      : null,
} as const;

/** Drives whether the UI offers "Continue with Google" at all. */
export const googleAuthEnabled = env.google !== null;
