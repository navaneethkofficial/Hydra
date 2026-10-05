import { getSessionUser } from "@/server/auth/session";
import { defineRoute } from "@/server/http/route";
import type { SessionDto } from "@/types/auth";

/**
 * Lets the client confirm who it is talking to without a full dashboard load.
 * The sign-in forms call this right after authenticating, to prove the browser
 * actually kept the session cookie (see `lib/auth-client.ts`).
 */
export const GET = defineRoute({ auth: false, rateLimit: "read" }, async (): Promise<SessionDto> => {
  const user = await getSessionUser();
  return {
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          timezone: user.timezone,
          theme: user.theme,
          onboarded: user.onboardedAt !== null,
        }
      : null,
  };
});
