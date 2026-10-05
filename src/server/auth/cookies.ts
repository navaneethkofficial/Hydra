import "server-only";
import { headers } from "next/headers";

import { env } from "@/server/env";
import { shouldUseSecureCookies } from "./cookie-policy";

/**
 * The one place auth cookie attributes are decided.
 *
 * Every cookie that proves who someone is (the session, the OAuth `state`)
 * goes through here, so the `Secure` decision and the rest of the hardening
 * can never drift between them. See `cookie-policy.ts` for why `Secure` follows
 * the request rather than `NODE_ENV`.
 */

export interface AuthCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
}

/**
 * Attributes for an auth cookie on the current request. Callers add the
 * lifetime (`expires` or `maxAge`) that fits the cookie.
 */
export async function authCookieOptions(): Promise<AuthCookieOptions> {
  const requestHeaders = await headers();

  return {
    // Unreadable from JavaScript, so an XSS bug can't lift a session.
    httpOnly: true,
    // Sent on top-level navigations (the OAuth redirect back to us) but not on
    // cross-site subrequests, which is the CSRF line for this app.
    sameSite: "lax",
    secure: shouldUseSecureCookies(env.authCookieSecure, requestHeaders.get("x-forwarded-proto")),
    path: "/",
  };
}
