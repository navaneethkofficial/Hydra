import { badRequest } from "@/server/http/errors";
import { defineRoute } from "@/server/http/route";
import { deleteLog } from "@/server/services/hydration.service";

export const DELETE = defineRoute({ rateLimit: "write" }, async ({ params, user }) => {
  const id = params.id;
  if (!id) throw badRequest("Which drink should we remove?");
  // The service scopes the delete to this user, so one account can never remove
  // another's log by guessing an id.
  return deleteLog(user.id, id);
});
