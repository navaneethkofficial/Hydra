/**
 * Browser-side sign-in and registration.
 *
 * A 200 from the login endpoint only proves the credentials were right. It does
 * not prove the browser kept the session cookie: one set with `Secure` over
 * plain HTTP, or blocked by privacy settings, is dropped without any error.
 * The next page then finds no session and sends the user back to sign-in, and
 * the failure looks like nothing happened at all.
 *
 * So every flow that creates a session finishes by asking the server who we
 * are. If the answer is "nobody", the user gets an explanation instead of a
 * silent bounce.
 */

import { api } from "@/lib/api-client";
import type { AuthResultDto, SessionDto } from "@/types/auth";

/** The browser accepted the credentials' response but did not keep the session cookie. */
export class SessionNotPersistedError extends Error {
  constructor() {
    super(
      "You signed in, but your browser didn't keep the session. Open Hydra over HTTPS " +
        "(or on localhost) and check that cookies aren't blocked for this site, then try again.",
    );
    this.name = "SessionNotPersistedError";
  }
}

export interface SignInInput {
  email: string;
  password: string;
  timezone?: string;
}

export interface RegisterInput extends SignInInput {
  name: string;
}

/** Signs in with email and password, then confirms the session took. */
export async function signIn(input: SignInInput): Promise<AuthResultDto> {
  return withConfirmedSession(api.post<AuthResultDto>("/api/auth/login", input));
}

/** Creates an account (which signs the user in), then confirms the session took. */
export async function register(input: RegisterInput): Promise<AuthResultDto> {
  return withConfirmedSession(api.post<AuthResultDto>("/api/auth/register", input));
}

/**
 * Resolves once the browser is verifiably signed in.
 *
 * Throws `SessionNotPersistedError` when the server sees no session cookie.
 * Network and server errors propagate unchanged as `ApiClientError`.
 */
export async function confirmSession(): Promise<void> {
  const { user } = await api.get<SessionDto>("/api/auth/session");
  if (!user) throw new SessionNotPersistedError();
}

/** Awaits an authenticating request, then refuses to report success without a session. */
async function withConfirmedSession<T>(request: Promise<T>): Promise<T> {
  const result = await request;
  await confirmSession();
  return result;
}
