/**
 * End-to-end checks for the sign-in form, in a real browser.
 *
 * Unit tests pin the pieces; these pin the failure modes users actually hit,
 * which only show up with a browser, a cookie jar and a hydrating page:
 * validation messages that never appeared, a submit before hydration that put
 * the password in the URL, and a session cookie silently dropped by the
 * browser.
 *
 * Run against a running app (dev or production build):
 *
 *   E2E_BASE_URL=http://localhost:3000 npm run test:e2e
 *
 * Drives the locally installed Chrome; set CHROME_PATH to use another
 * Chromium-based binary. Each run registers a throwaway account and deletes
 * it at the end.
 */

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { chromium, type APIRequestContext, type Browser, type Page } from "playwright-core";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const account = {
  name: "E2E",
  email: `e2e-${randomBytes(6).toString("hex")}@hydra.test`,
  password: `pw-${randomBytes(9).toString("base64url")}`,
};

let browser: Browser;
/** Owns the throwaway account's session, for setup and cleanup. */
let owner: APIRequestContext;

before(async () => {
  browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" },
  );

  owner = (await browser.newContext({ baseURL: BASE_URL })).request;
  const registered = await owner.post("/api/auth/register", { data: account });
  assert.equal(registered.status(), 201, `registering the test account: ${await registered.text()}`);
});

after(async () => {
  // Deleting the account also deletes its sessions and history.
  await owner?.delete("/api/account").catch(() => undefined);
  await browser?.close();
});

/** A fresh, cookie-less page on the sign-in screen with its handlers attached. */
async function openLogin(options: { javaScriptEnabled?: boolean } = {}): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE_URL, ...options });
  const page = await context.newPage();
  await page.goto("/login");
  if (options.javaScriptEnabled !== false) {
    await page.locator("button[type=submit]:not([disabled])").waitFor();
  }
  return page;
}

async function submit(page: Page, email: string, password: string): Promise<void> {
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
}

/** Counts sign-in API calls made by the page from now on. */
function countLoginRequests(page: Page): () => number {
  let count = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/auth/login") count += 1;
  });
  return () => count;
}

describe("sign-in form", () => {
  it("shows inline messages for empty fields without calling the API", async () => {
    const page = await openLogin();
    const loginRequests = countLoginRequests(page);

    await submit(page, "", "");

    await page.getByText("Enter your email address.").waitFor();
    await page.getByText("Enter your password.").waitFor();
    assert.equal(loginRequests(), 0);
    await page.context().close();
  });

  it("explains a rejected password", async () => {
    const page = await openLogin();

    await submit(page, account.email, "definitely-wrong");

    await page.getByText("That email or password doesn't look right.").waitFor();
    assert.match(page.url(), /\/login$/);
    await page.context().close();
  });

  it("signs in and lands past the sign-in screen", async () => {
    const page = await openLogin();

    await submit(page, account.email, account.password);

    await page.waitForURL(/\/(onboarding|today)$/);
    const cookies = await page.context().cookies();
    assert.ok(cookies.some((cookie) => cookie.name === "hydra_session"));
    await page.context().close();
  });

  it("says so when the browser drops the session cookie", async () => {
    const page = await openLogin();
    // Simulate a browser refusing the cookie (Secure over HTTP, blocked cookies).
    // `route.fetch()` stores the response's cookie in the context's jar, so it
    // is cleared there as well as stripped from what the page sees.
    await page.route("**/api/auth/login", async (route) => {
      const response = await route.fetch();
      await page.context().clearCookies();
      const headers = { ...response.headers() };
      delete headers["set-cookie"];
      await route.fulfill({ response, headers });
    });

    await submit(page, account.email, account.password);

    await page.getByText(/your browser didn't keep the session/i).waitFor();
    assert.match(page.url(), /\/login$/);
    await page.context().close();
  });

  it("cannot be submitted before the page is interactive", async () => {
    // With JavaScript off the page never hydrates: the worst case of a slow load.
    const page = await openLogin({ javaScriptEnabled: false });

    assert.equal(await page.locator("button[type=submit]").isDisabled(), true);
    assert.equal(await page.locator("form").getAttribute("method"), "post");
    // Playwright's text queries skip <noscript>, so read the element directly.
    const notice = await page.locator("noscript [role=alert]").innerText();
    assert.match(notice, /Hydra needs JavaScript to sign you in/);

    // Enter in a field must not trigger a native submit either.
    await page.fill("#email", account.email);
    await page.fill("#password", account.password);
    await page.press("#password", "Enter");
    assert.doesNotMatch(page.url(), /password=/);
    await page.context().close();
  });
});

describe("session cookie", () => {
  it("is Secure exactly when the request was HTTPS", async () => {
    const context = await browser.newContext({ baseURL: BASE_URL });
    const response = await context.request.post("/api/auth/login", {
      data: { email: account.email, password: account.password },
    });
    assert.equal(response.status(), 200);

    const setCookie = response.headersArray().find((header) => header.name.toLowerCase() === "set-cookie");
    assert.ok(setCookie, "login sets a cookie");
    const isSecure = /;\s*secure/i.test(setCookie.value);
    assert.equal(isSecure, new URL(BASE_URL).protocol === "https:");
    await context.close();
  });
});
