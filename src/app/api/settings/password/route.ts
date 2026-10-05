import { defineRoute } from "@/server/http/route";
import { changePassword } from "@/server/services/settings.service";
import { changePasswordSchema } from "@/server/validation/schemas";

export const POST = defineRoute(
  { schema: changePasswordSchema, rateLimit: "auth" },
  async ({ body, user }) => {
    await changePassword(user.id, body.currentPassword, body.newPassword);
    // Every session was just revoked, including this one.
    return { message: "Password updated. Sign in again with your new password." };
  },
);
