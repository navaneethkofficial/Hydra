import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { authCookieOptions } from "@/server/auth/cookies";
import { env } from "@/server/env";

/**
 * Step 1 of Google sign-in: redirect to Google with a one-time `state` value
 * stored in a short-lived httpOnly cookie, which the callback checks to reject
 * cross-site request forgery.
 *
 * The whole flow is inert unless GOOGLE_CLIENT_ID/SECRET are configured — the
 * UI hides the button in that case, and this route refuses politely.
 */

export const OAUTH_STATE_COOKIE = "hydra_oauth_state";

export async function GET(): Promise<NextResponse> {
  if (!env.google) {
    return NextResponse.redirect(`${env.appUrl}/login?error=google_not_configured`);
  }

  const state = randomBytes(24).toString("base64url");
  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, state, { ...(await authCookieOptions()), maxAge: 600 });

  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.searchParams.set("client_id", env.google.clientId);
  authorizeUrl.searchParams.set("redirect_uri", `${env.appUrl}/api/auth/google/callback`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid email profile");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(authorizeUrl.toString());
}
