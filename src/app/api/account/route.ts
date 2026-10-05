import { destroySession } from "@/server/auth/session";
import { defineRoute } from "@/server/http/route";
import { deleteAccount } from "@/server/services/settings.service";

export const DELETE = defineRoute({ rateLimit: "auth" }, async ({ user }) => {
  await deleteAccount(user.id);
  await destroySession();
  return { message: "Your account and hydration history have been deleted." };
});
