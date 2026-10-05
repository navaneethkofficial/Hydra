import { defineRoute } from "@/server/http/route";
import { completeOnboarding } from "@/server/services/settings.service";
import { onboardingSchema } from "@/server/validation/schemas";

export const POST = defineRoute(
  { schema: onboardingSchema, rateLimit: "write" },
  async ({ body, user }) => completeOnboarding(user.id, body),
);
