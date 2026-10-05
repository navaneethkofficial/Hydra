import { clientIp, defineRoute } from "@/server/http/route";
import { login } from "@/server/services/auth.service";
import { loginSchema } from "@/server/validation/schemas";

export const POST = defineRoute(
  { auth: false, schema: loginSchema, rateLimit: "auth" },
  async ({ body, request }) =>
    login(body, { userAgent: request.headers.get("user-agent"), ip: clientIp(request) }),
);
