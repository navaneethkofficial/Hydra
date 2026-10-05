import { defineRoute } from "@/server/http/route";
import { logWaterBatch } from "@/server/services/hydration.service";
import { logWaterBatchSchema } from "@/server/validation/schemas";

/**
 * Flushes drinks that were logged while offline. Idempotent per `clientId`, so
 * a retry after a flaky connection cannot double-count anyone's water.
 */
export const POST = defineRoute(
  { schema: logWaterBatchSchema, rateLimit: "write" },
  async ({ body, user }) => logWaterBatch(user.id, body.entries),
);
