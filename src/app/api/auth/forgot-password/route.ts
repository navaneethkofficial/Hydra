import { defineRoute } from "@/server/http/route";
import { requestPasswordReset } from "@/server/services/auth.service";
import { forgotPasswordSchema } from "@/server/validation/schemas";

export const POST = defineRoute(
  { auth: false, schema: forgotPasswordSchema, rateLimit: "passwordReset" },
  async ({ body }) => {
    const { resetUrl } = await requestPasswordReset(body.email);
    // The response is identical whether or not the address exists, so it can't
    // be used to find out who has an account.
    return {
      message: "If that email has an account, a reset link is on its way.",
      ...(resetUrl && { devResetUrl: resetUrl }),
    };
  },
);
