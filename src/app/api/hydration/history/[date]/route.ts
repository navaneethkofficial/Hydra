import { badRequest } from "@/server/http/errors";
import { defineRoute } from "@/server/http/route";
import { getDayDetail } from "@/server/services/hydration.service";
import { dayKeySchema } from "@/server/validation/schemas";

export const GET = defineRoute({ rateLimit: "read" }, async ({ params, user }) => {
  const parsed = dayKeySchema.safeParse(params.date);
  if (!parsed.success) throw badRequest("Use a date like 2026-09-07.");
  return getDayDetail(user.id, parsed.data);
});
