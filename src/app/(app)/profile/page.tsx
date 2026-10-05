import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SettingsView } from "@/components/settings/settings-view";
import { getSessionUser } from "@/server/auth/session";
import { getSettings } from "@/server/services/settings.service";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <SettingsView initial={await getSettings(user.id)} />;
}
