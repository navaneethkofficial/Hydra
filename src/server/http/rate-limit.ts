import "server-only";

import { env } from "@/server/env";
import { FallbackStore, MemoryStore, UpstashStore, type RateLimitStore } from "./rate-limit-store";

/**
 * Fixed-window rate limiting.
 *
 * Protects the endpoints that matter (auth, password reset, write bursts).
 * Counters live in Upstash Redis when it's configured, which is what makes
 * limits hold across serverless instances (Vercel), and in process memory
 * otherwise, which is right for a single server and local development. See
 * `rate-limit-store.ts` for the stores; call sites never see the difference.
 */

export interface RateLimitRule {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
}

/** Presets, tuned so normal use never notices them. */
export const RATE_LIMITS = {
  /** Sign-in and registration: slow enough to make guessing pointless. */
  auth: { limit: 10, windowSeconds: 300 },
  /** Password reset requests, which send mail. */
  passwordReset: { limit: 5, windowSeconds: 900 },
  /** Water logging — generous, since offline replays arrive in bursts. */
  write: { limit: 120, windowSeconds: 60 },
  /** Everything else. */
  read: { limit: 300, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

const store: RateLimitStore = env.upstash
  ? new FallbackStore(new UpstashStore(env.upstash), new MemoryStore(), (error) =>
      console.error("[rate-limit] shared store unavailable; using per-instance limits", error),
    )
  : new MemoryStore();

export async function checkRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const { count, resetAt } = await store.hit(key, rule.windowSeconds);

  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfter: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
  };
}
