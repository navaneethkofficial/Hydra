import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { InsightsView } from "@/components/insights/insights-view";
import { getSessionUser } from "@/server/auth/session";
import { getInsights } from "@/server/services/insights.service";

export const metadata: Metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <InsightsView data={await getInsights(user.id, 28)} />;
}
