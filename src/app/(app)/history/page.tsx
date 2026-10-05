import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HistoryView } from "@/components/history/history-view";
import { toDayKey } from "@/lib/domain/time";
import { getSessionUser } from "@/server/auth/session";
import { getHistory } from "@/server/services/hydration.service";

export const metadata: Metadata = { title: "History" };
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // The current month is rendered on the server; other months load on demand.
  // "Current" means the user's local month, not the server's.
  const monthStart = `${toDayKey(new Date(), user.timezone).slice(0, 7)}-01`;
  const history = await getHistory(user.id, { from: monthStart });

  return <HistoryView initial={history} />;
}
