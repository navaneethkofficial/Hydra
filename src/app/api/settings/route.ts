import { defineRoute } from "@/server/http/route";
import { getSettings, updateSettings } from "@/server/services/settings.service";
import { updateSettingsSchema } from "@/server/validation/schemas";

export const GET = defineRoute({ rateLimit: "read" }, async ({ user }) => getSettings(user.id));

export const PUT = defineRoute(
  { schema: updateSettingsSchema, rateLimit: "write" },
  async ({ body, user }) => updateSettings(user.id, body),
);
