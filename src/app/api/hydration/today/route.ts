import { defineRoute } from "@/server/http/route";
import { getToday } from "@/server/services/hydration.service";

/** Everything the dashboard renders, in one round trip. */
export const GET = defineRoute({ rateLimit: "read" }, async ({ user }) => getToday(user.id));
