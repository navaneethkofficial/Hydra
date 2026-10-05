import { toFieldErrors } from "@/lib/form-validation";
import { badRequest } from "@/server/http/errors";
import { defineRoute } from "@/server/http/route";
import { getInsights } from "@/server/services/insights.service";
import { insightsQuerySchema } from "@/server/validation/schemas";

export const GET = defineRoute({ rateLimit: "read" }, async ({ searchParams, user }) => {
  const parsed = insightsQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) throw badRequest("Check the range.", toFieldErrors(parsed.error));
  return getInsights(user.id, parsed.data.days);
});
