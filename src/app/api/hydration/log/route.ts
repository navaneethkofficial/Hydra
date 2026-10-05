import { created } from "@/server/http/response";
import { defineRoute } from "@/server/http/route";
import { logWater } from "@/server/services/hydration.service";
import { logWaterSchema } from "@/server/validation/schemas";

export const POST = defineRoute(
  { schema: logWaterSchema, rateLimit: "write" },
  async ({ body, user }) => created(await logWater(user.id, body)),
);
