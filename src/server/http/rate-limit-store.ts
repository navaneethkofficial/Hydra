/**
 * Where rate-limit counters live.
 *
 * A fixed-window limiter needs one primitive: "count this hit against `key`
 * and tell me the window's total and when it resets". Each store provides
 * exactly that, so the limiter's policy (`rate-limit.ts`) never changes when
 * the backing changes.
 *
 *  - `MemoryStore`: counters in this process. Right for a single long-lived
 *    server; on serverless hosts every instance counts separately and forgets
 *    on shutdown, so it can only slow an attacker down, not stop one.
 *  - `UpstashStore`: counters in Upstash Redis over its REST API, shared by
 *    every instance. Plain `fetch`, so no SDK or TCP connection is needed and
 *    it works in serverless and edge runtimes alike.
 *
 * Free of `server-only` and of `env`, so the stores can be unit-tested directly.
 */

export interface WindowHit {
  /** Hits in the current window, including this one. */
  count: number;
  /** Epoch milliseconds at which the window resets. */
  resetAt: number;
}

export interface RateLimitStore {
  /** Records one hit against `key` in a window of `windowSeconds`, starting one if none is open. */
  hit(key: string, windowSeconds: number): Promise<WindowHit>;
}

// ---------------------------------------------------------------------------

/** Keys tracked before expired windows are swept, bounding memory use. */
const MAX_TRACKED_KEYS = 10_000;

export class MemoryStore implements RateLimitStore {
  private readonly windows = new Map<string, WindowHit>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  async hit(key: string, windowSeconds: number): Promise<WindowHit> {
    const now = this.now();
    const existing = this.windows.get(key);

    if (existing && existing.resetAt > now) {
      existing.count += 1;
      return { ...existing };
    }

    if (this.windows.size >= MAX_TRACKED_KEYS) this.evict(now);
    const fresh = { count: 1, resetAt: now + windowSeconds * 1000 };
    this.windows.set(key, fresh);
    return { ...fresh };
  }

  private evict(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
    // Still full of live windows: drop the quarter closest to expiry.
    if (this.windows.size >= MAX_TRACKED_KEYS) {
      const oldest = [...this.windows.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
      for (const [key] of oldest.slice(0, Math.ceil(MAX_TRACKED_KEYS / 4))) this.windows.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------

export interface UpstashConfig {
  /** REST endpoint, e.g. `https://eu1-example-12345.upstash.io`. */
  url: string;
  /** REST token with write access. */
  token: string;
  /** Namespace for this app's keys, so one database can serve several apps. */
  prefix?: string;
  /**
   * Give up after this long, so a slow Redis can't stall every request; the
   * caller's fallback then takes over. Defaults to 1000 ms.
   */
  timeoutMs?: number;
}

type UpstashReply = Array<{ result?: unknown; error?: string }>;

export class UpstashStore implements RateLimitStore {
  private readonly endpoint: string;
  private readonly token: string;
  private readonly prefix: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(config: UpstashConfig, fetchImpl: typeof fetch = fetch, now: () => number = Date.now) {
    this.endpoint = `${config.url.replace(/\/+$/, "")}/pipeline`;
    this.token = config.token;
    this.prefix = config.prefix ?? "hydra:rl:";
    this.timeoutMs = config.timeoutMs ?? 1000;
    this.fetchImpl = fetchImpl;
    this.now = now;
  }

  /**
   * One round trip, three commands:
   *  1. `SET key 0 PX window NX` opens the window and its expiry, only if none is open;
   *  2. `INCR key` counts this hit (INCR keeps the expiry);
   *  3. `PTTL key` reports when the window resets.
   * Every command is supported by any Redis version, so no `EXPIRE … NX` is needed.
   */
  async hit(key: string, windowSeconds: number): Promise<WindowHit> {
    const redisKey = `${this.prefix}${key}`;
    const windowMs = windowSeconds * 1000;

    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["SET", redisKey, "0", "PX", String(windowMs), "NX"],
        ["INCR", redisKey],
        ["PTTL", redisKey],
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) throw new Error(`Upstash responded ${response.status}`);

    const replies = (await response.json()) as UpstashReply;
    const failed = replies.find((reply) => reply.error);
    if (failed) throw new Error(`Upstash error: ${failed.error}`);

    const count = Number(replies[1]?.result);
    const ttl = Number(replies[2]?.result);
    if (!Number.isFinite(count)) throw new Error("Upstash returned no count");

    // A key without an expiry (-1) would count forever; treat it as a full window.
    return { count, resetAt: this.now() + (ttl > 0 ? ttl : windowMs) };
  }
}

// ---------------------------------------------------------------------------

/**
 * Uses `primary`, falling back to `fallback` when it fails.
 *
 * A limiter outage must not become a sign-in outage, but it shouldn't remove
 * the limit entirely either: the fallback keeps per-instance limits in place
 * until the shared store recovers.
 */
export class FallbackStore implements RateLimitStore {
  private readonly primary: RateLimitStore;
  private readonly fallback: RateLimitStore;
  private readonly onError: (error: unknown) => void;

  constructor(
    primary: RateLimitStore,
    fallback: RateLimitStore,
    onError: (error: unknown) => void = () => {},
  ) {
    this.primary = primary;
    this.fallback = fallback;
    this.onError = onError;
  }

  async hit(key: string, windowSeconds: number): Promise<WindowHit> {
    try {
      return await this.primary.hit(key, windowSeconds);
    } catch (error) {
      this.onError(error);
      return this.fallback.hit(key, windowSeconds);
    }
  }
}
