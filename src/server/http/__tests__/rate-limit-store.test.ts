import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FallbackStore, MemoryStore, UpstashStore, type RateLimitStore } from "../rate-limit-store";

describe("MemoryStore", () => {
  it("counts hits within a window and starts afresh after it", async () => {
    let now = 1_000_000;
    const store = new MemoryStore(() => now);

    assert.deepEqual(await store.hit("k", 60), { count: 1, resetAt: now + 60_000 });
    assert.equal((await store.hit("k", 60)).count, 2);

    now += 60_000;
    assert.deepEqual(await store.hit("k", 60), { count: 1, resetAt: now + 60_000 });
  });

  it("keeps keys independent", async () => {
    const store = new MemoryStore();
    await store.hit("a", 60);
    assert.equal((await store.hit("b", 60)).count, 1);
  });
});

/** A fetch that answers like Upstash's pipeline endpoint and records what it was sent. */
function upstashFetch(reply: unknown, status = 200) {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    requests.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(reply), { status });
  }) as typeof fetch;
  return { fetchImpl, requests };
}

describe("UpstashStore", () => {
  const config = { url: "https://example.upstash.io/", token: "secret-token" };

  it("opens, counts and times the window in one pipelined round trip", async () => {
    const { fetchImpl, requests } = upstashFetch([{ result: "OK" }, { result: 3 }, { result: 42_000 }]);
    const store = new UpstashStore(config, fetchImpl, () => 5_000);

    const hit = await store.hit("/api/auth/login:1.2.3.4", 300);

    assert.deepEqual(hit, { count: 3, resetAt: 47_000 });
    assert.equal(requests.length, 1);
    assert.equal(requests[0]!.url, "https://example.upstash.io/pipeline");
    assert.equal((requests[0]!.init.headers as Record<string, string>).Authorization, "Bearer secret-token");
    assert.deepEqual(JSON.parse(String(requests[0]!.init.body)), [
      ["SET", "hydra:rl:/api/auth/login:1.2.3.4", "0", "PX", "300000", "NX"],
      ["INCR", "hydra:rl:/api/auth/login:1.2.3.4"],
      ["PTTL", "hydra:rl:/api/auth/login:1.2.3.4"],
    ]);
  });

  it("treats a key without an expiry as a full window", async () => {
    const { fetchImpl } = upstashFetch([{ result: null }, { result: 1 }, { result: -1 }]);
    const store = new UpstashStore(config, fetchImpl, () => 0);
    assert.deepEqual(await store.hit("k", 60), { count: 1, resetAt: 60_000 });
  });

  it("throws on an HTTP failure or a command error, so the caller can fall back", async () => {
    await assert.rejects(new UpstashStore(config, upstashFetch({}, 401).fetchImpl).hit("k", 60), /401/);
    await assert.rejects(
      new UpstashStore(config, upstashFetch([{ error: "WRONGPASS" }, {}, {}]).fetchImpl).hit("k", 60),
      /WRONGPASS/,
    );
  });
});

describe("UpstashStore timeout", () => {
  it("gives up on a store that never answers", async () => {
    const hanging = ((_url: string | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      })) as typeof fetch;
    const store = new UpstashStore({ url: "https://example.upstash.io", token: "t", timeoutMs: 20 }, hanging);

    await assert.rejects(store.hit("k", 60), (error: Error) => error.name === "TimeoutError");
  });
});

describe("FallbackStore", () => {
  const failing: RateLimitStore = {
    hit: async () => {
      throw new Error("down");
    },
  };

  it("keeps limiting with the fallback when the primary fails, and reports it", async () => {
    const errors: unknown[] = [];
    const store = new FallbackStore(failing, new MemoryStore(), (error) => errors.push(error));

    await store.hit("k", 60);
    assert.equal((await store.hit("k", 60)).count, 2);
    assert.equal(errors.length, 2);
  });

  it("uses the primary while it works", async () => {
    const primary = new MemoryStore();
    const fallback = new MemoryStore();
    const store = new FallbackStore(primary, fallback);

    await store.hit("k", 60);
    assert.equal((await fallback.hit("k", 60)).count, 1);
  });
});
