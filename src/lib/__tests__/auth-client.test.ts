import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { ApiClientError } from "../api-client";
import { confirmSession, register, SessionNotPersistedError, signIn } from "../auth-client";

/**
 * The API client is exercised against a scripted `fetch`, so these tests pin
 * the browser-side contract without a server: which requests a sign-in makes,
 * and what the user is told when the session cookie doesn't stick.
 */

type Scripted = { status: number; body: unknown };

const USER = {
  id: "u1",
  name: "Alex",
  email: "alex@hydra.app",
  image: null,
  timezone: "UTC",
  theme: "SYSTEM",
  onboarded: true,
};

let calls: Array<{ method: string; path: string }> = [];
const originalFetch = globalThis.fetch;

function script(responses: Record<string, Scripted>): void {
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({ method, path: url.pathname });
    const scripted = responses[`${method} ${url.pathname}`];
    if (!scripted) throw new TypeError(`Unscripted request: ${method} ${url.pathname}`);
    return new Response(JSON.stringify(scripted.body), {
      status: scripted.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

beforeEach(() => {
  calls = [];
  (globalThis as { window?: unknown }).window = { location: { origin: "http://hydra.test" } };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete (globalThis as { window?: unknown }).window;
});

const credentials = { email: "alex@hydra.app", password: "hydrate123" };
const loggedIn = { status: 200, body: { data: { user: USER, needsOnboarding: false } } };

describe("signIn", () => {
  it("logs in, then confirms the session before reporting success", async () => {
    script({
      "POST /api/auth/login": loggedIn,
      "GET /api/auth/session": { status: 200, body: { data: { user: USER } } },
    });

    const result = await signIn(credentials);

    assert.equal(result.needsOnboarding, false);
    assert.deepEqual(calls, [
      { method: "POST", path: "/api/auth/login" },
      { method: "GET", path: "/api/auth/session" },
    ]);
  });

  it("explains a session cookie the browser dropped instead of failing silently", async () => {
    script({
      "POST /api/auth/login": loggedIn,
      "GET /api/auth/session": { status: 200, body: { data: { user: null } } },
    });

    await assert.rejects(signIn(credentials), (error: unknown) => {
      assert.ok(error instanceof SessionNotPersistedError);
      assert.match(error.message, /HTTPS/);
      return true;
    });
  });

  it("surfaces rejected credentials with their code and skips the session check", async () => {
    script({
      "POST /api/auth/login": {
        status: 401,
        body: {
          error: { code: "INVALID_CREDENTIALS", message: "That email or password doesn't look right." },
        },
      },
    });

    await assert.rejects(signIn(credentials), (error: unknown) => {
      assert.ok(error instanceof ApiClientError);
      assert.equal(error.code, "INVALID_CREDENTIALS");
      assert.equal(error.status, 401);
      return true;
    });
    assert.equal(calls.length, 1);
  });
});

describe("register", () => {
  it("confirms the session the new account was given", async () => {
    script({
      "POST /api/auth/register": { status: 201, body: { data: { user: USER, needsOnboarding: true } } },
      "GET /api/auth/session": { status: 200, body: { data: { user: null } } },
    });

    await assert.rejects(register({ ...credentials, name: "Alex" }), SessionNotPersistedError);
  });
});

describe("confirmSession", () => {
  it("reports a lost connection as offline, not as a blocked cookie", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;

    await assert.rejects(confirmSession(), (error: unknown) => {
      assert.ok(error instanceof ApiClientError);
      assert.equal(error.code, "OFFLINE");
      return true;
    });
  });
});
