import { defineRoute } from "@/server/http/route";
import { resetPassword } from "@/server/services/auth.service";
import { resetPasswordSchema } from "@/server/validation/schemas";

export const POST = defineRoute(
  { auth: false, schema: resetPasswordSchema, rateLimit: "passwordReset" },
  async ({ body }) => {
    await resetPassword(body.token, body.password);
    return { message: "Your password has been updated. Sign in with it now." };
  },
);
