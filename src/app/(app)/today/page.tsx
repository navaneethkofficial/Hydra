import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TodayView } from "@/components/hydration/today-view";
import { HydrationProvider } from "@/hooks/use-hydration";
import { getSessionUser } from "@/server/auth/session";
import { getToday } from "@/server/services/hydration.service";

export const metadata: Metadata = { title: "Today" };

/**
 * Rendered on the server with the day's data already in the markup, so the
 * dashboard is readable on the first paint rather than after a fetch — the
 * difference between "see → tap" and "wait → see → tap".
 */
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const today = await getToday(user.id);

  return (
    <HydrationProvider initialToday={today}>
      <TodayView />
    </HydrationProvider>
  );
}
