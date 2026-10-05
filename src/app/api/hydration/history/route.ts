import { toFieldErrors } from "@/lib/form-validation";
import { defineRoute } from "@/server/http/route";
import { badRequest } from "@/server/http/errors";
import { getHistory } from "@/server/services/hydration.service";
import { historyQuerySchema } from "@/server/validation/schemas";

export const GET = defineRoute({ rateLimit: "read" }, async ({ searchParams, user }) => {
  const parsed = historyQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) throw badRequest("Check the date range.", toFieldErrors(parsed.error));
  return getHistory(user.id, parsed.data);
});
