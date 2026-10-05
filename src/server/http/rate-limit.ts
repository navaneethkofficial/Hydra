import "server-only";

/**
 * Fixed-window rate limiting, in process memory.
 *
 * Deliberately dependency-free: it protects the endpoints that matter (auth,
 * password reset, write bursts) on a single instance. Behind more than one
 * instance this is where a shared Redis counter would slot in — the call sites
 * would not change.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 10_000;

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

export function checkRateLimit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_TRACKED_KEYS) evictExpired(now);
    buckets.set(key, { count: 1, resetAt: now + rule.windowSeconds * 1000 });
    return { allowed: true, remaining: rule.limit - 1, retryAfter: rule.windowSeconds };
  }

  existing.count += 1;
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  return {
    allowed: existing.count <= rule.limit,
    remaining: Math.max(0, rule.limit - existing.count),
    retryAfter,
  };
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

function evictExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still full of live windows: drop the oldest to bound memory.
  if (buckets.size >= MAX_TRACKED_KEYS) {
    const oldest = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (const [key] of oldest.slice(0, Math.ceil(MAX_TRACKED_KEYS / 4))) buckets.delete(key);
  }
}
