/**
 * When auth cookies carry the `Secure` attribute.
 *
 * Browsers silently discard a `Secure` cookie set over plain HTTP from any host
 * other than `localhost`. Tying the flag to `NODE_ENV` therefore broke sign-in
 * for a production build opened over HTTP from a LAN address (a phone testing
 * the app, an internal deployment without TLS): the API answered 200, the
 * cookie was dropped, and the next page bounced the user back to sign-in with
 * no explanation.
 *
 * The default, `auto`, marks the cookie `Secure` exactly when the request
 * arrived over HTTPS. That keeps the property that matters: a cookie issued
 * over HTTPS is never sent back over HTTP. Deployments can pin the behaviour
 * with `AUTH_COOKIE_SECURE`.
 *
 * Pure and free of `server-only` on purpose, so it can be unit-tested directly.
 */

export type SecureCookieMode = "auto" | "always" | "never";

const MODE_ALIASES: Record<string, SecureCookieMode> = {
  auto: "auto",
  always: "always",
  true: "always",
  never: "never",
  false: "never",
};

/**
 * Reads `AUTH_COOKIE_SECURE`. Unset means `auto`; an unrecognised value throws,
 * so a typo fails at boot instead of quietly weakening the cookie.
 */
export function parseSecureCookieMode(raw: string | undefined): SecureCookieMode {
  const value = raw?.trim().toLowerCase();
  if (!value) return "auto";

  const mode = MODE_ALIASES[value];
  if (!mode) {
    throw new Error(
      `AUTH_COOKIE_SECURE must be one of auto, always, never (or true/false); received "${raw}".`,
    );
  }
  return mode;
}

/**
 * Whether the browser reached us over HTTPS.
 *
 * Next.js fills `x-forwarded-proto` from the socket when no proxy has set it,
 * and a TLS-terminating proxy sets it to `https`. A chain of proxies may send a
 * list (`https, http`); the first entry is the one the browser used.
 */
export function isHttpsRequest(forwardedProto: string | null | undefined): boolean {
  const first = forwardedProto?.split(",")[0]?.trim().toLowerCase();
  return first === "https";
}

/** Resolves the `Secure` attribute for one response. */
export function shouldUseSecureCookies(
  mode: SecureCookieMode,
  forwardedProto: string | null | undefined,
): boolean {
  switch (mode) {
    case "always":
      return true;
    case "never":
      return false;
    case "auto":
      return isHttpsRequest(forwardedProto);
  }
}
