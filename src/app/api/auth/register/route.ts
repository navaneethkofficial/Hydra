import { defineRoute, clientIp } from "@/server/http/route";
import { created } from "@/server/http/response";
import { register } from "@/server/services/auth.service";
import { registerSchema } from "@/server/validation/schemas";

export const POST = defineRoute(
  { auth: false, schema: registerSchema, rateLimit: "auth" },
  async ({ body, request }) =>
    created(
      await register(body, {
        userAgent: request.headers.get("user-agent"),
        ip: clientIp(request),
      }),
    ),
);
