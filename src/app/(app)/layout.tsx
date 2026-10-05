import { redirect } from "next/navigation";

import { AppNav } from "@/components/layout/app-nav";
import { BottomNav } from "@/components/layout/bottom-nav";
import { getSessionUser } from "@/server/auth/session";

/**
 * The authenticated shell.
 *
 * One guard for the whole app area: no page inside it renders for a signed-out
 * visitor, and nobody who skipped onboarding reaches a screen that assumes a
 * goal exists.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.onboardedAt) redirect("/onboarding");

  return (
    <div className="min-h-dvh">
      <AppNav
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          timezone: user.timezone,
          theme: user.theme,
          onboarded: true,
        }}
      />
      {/* Bottom padding clears the mobile navigation bar. */}
      <main id="main" className="container-page pb-28 pt-6 md:pb-16 md:pt-8">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
