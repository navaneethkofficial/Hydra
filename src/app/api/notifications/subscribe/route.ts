import { prisma } from "@/server/db";
import { defineRoute } from "@/server/http/route";
import { pushSubscriptionSchema } from "@/server/validation/schemas";

/**
 * Stores a browser push subscription.
 *
 * Reminders are scheduled client-side while a tab is open; this endpoint is
 * what a server-side scheduler would deliver through once push keys are
 * configured for the deployment.
 */
export const POST = defineRoute(
  { schema: pushSubscriptionSchema, rateLimit: "write" },
  async ({ body, user }) => {
    await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: {
        userId: user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
      update: { userId: user.id, p256dh: body.keys.p256dh, auth: body.keys.auth },
    });
    return { ok: true };
  },
);

export const DELETE = defineRoute({ rateLimit: "write" }, async ({ searchParams, user }) => {
  const endpoint = searchParams.get("endpoint");
  if (endpoint) await prisma.pushSubscription.deleteMany({ where: { userId: user.id, endpoint } });
  else await prisma.pushSubscription.deleteMany({ where: { userId: user.id } });
  return { ok: true };
});
