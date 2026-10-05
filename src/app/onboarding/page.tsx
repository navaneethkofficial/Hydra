import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Logo } from "@/components/layout/logo";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getSessionUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Set your goal" };

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // Onboarding is a one-time step; finishing it means never seeing it again.
  if (user.onboardedAt) redirect("/today");

  return (
    <div className="flex min-h-dvh flex-col px-5 py-8 sm:px-8">
      <Logo />
      <main id="main" className="flex flex-1 items-center justify-center py-10">
        <OnboardingFlow name={user.name.trim().split(/\s+/)[0] ?? user.name} />
      </main>
    </div>
  );
}
