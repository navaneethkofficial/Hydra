import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { decodeJwt } from "jose";

import { clientIp } from "@/server/http/route";
import { env } from "@/server/env";
import { signInWithOAuth } from "@/server/services/auth.service";
import { OAUTH_STATE_COOKIE } from "../route";

/**
 * Step 2 of Google sign-in: verify `state`, exchange the code for tokens, and
 * sign the user in.
 *
 * The id_token arrives over a TLS-authenticated, server-to-server call to
 * Google's token endpoint, so its claims are trustworthy without re-verifying
 * the signature locally.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const fail = (reason: string) => NextResponse.redirect(`${env.appUrl}/login?error=${reason}`);

  if (!env.google) return fail("google_not_configured");

  const store = await cookies();
  const expectedState = store.get(OAUTH_STATE_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state || !expectedState || state !== expectedState) return fail("google_state");

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.google.clientId,
        client_secret: env.google.clientSecret,
        redirect_uri: `${env.appUrl}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) return fail("google_exchange");

    const { id_token: idToken } = (await tokenResponse.json()) as { id_token?: string };
    if (!idToken) return fail("google_exchange");

    const claims = decodeJwt(idToken) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };

    // An unverified address could belong to someone else; refuse to link it.
    if (!claims.sub || !claims.email || claims.email_verified === false) {
      return fail("google_email");
    }

    const { needsOnboarding } = await signInWithOAuth(
      "google",
      {
        providerAccountId: claims.sub,
        email: claims.email.toLowerCase(),
        name: claims.name?.trim() || claims.email.split("@")[0] || "Friend",
        image: claims.picture ?? null,
      },
      { userAgent: request.headers.get("user-agent"), ip: clientIp(request) },
    );

    return NextResponse.redirect(`${env.appUrl}${needsOnboarding ? "/onboarding" : "/today"}`);
  } catch (error) {
    console.error("[auth] google callback failed", error);
    return fail("google_failed");
  }
}
