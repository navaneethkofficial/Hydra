import { destroySession } from "@/server/auth/session";
import { defineRoute } from "@/server/http/route";

export const POST = defineRoute({ auth: false, rateLimit: false }, async () => {
  await destroySession();
  return { ok: true };
});
