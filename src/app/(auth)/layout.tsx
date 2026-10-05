import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/layout/logo";
import { Alert } from "@/components/ui/alert";
import { HydrationRing } from "@/components/hydration/hydration-ring";
import { getSessionUser } from "@/server/auth/session";

/**
 * Shell for sign-in, registration and password recovery.
 *
 * The form owns the page on mobile; on large screens a quiet panel carries the
 * product promise so the page has somewhere to breathe.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Someone already signed in has no business on the sign-in page.
  const user = await getSessionUser();
  if (user) redirect(user.onboardedAt ? "/today" : "/onboarding");

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Logo />
        <main id="main" className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm space-y-5">
            {/* The forms submit through JavaScript and keep their buttons disabled
                until it loads, so say why if it never does. */}
            <noscript>
              <Alert tone="error">Hydra needs JavaScript to sign you in. Enable it and reload the page.</Alert>
            </noscript>
            {children}
          </div>
        </main>
        <p className="text-center text-xs text-muted-foreground lg:text-left">
          <Link href="/" className="transition-colors hover:text-foreground">
            ← Back to home
          </Link>
        </p>
      </div>

      <aside className="relative hidden items-center justify-center overflow-hidden border-l border-border bg-secondary/40 lg:flex">
        <div aria-hidden className="absolute -right-20 top-1/4 size-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative max-w-sm px-10 text-center">
          <HydrationRing consumed={1800} goal={2500} size={220} animate={false} className="mx-auto" />
          <h2 className="mt-10 text-balance text-2xl font-semibold tracking-tight">
            Drink water. Without having to remember.
          </h2>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
            Reminders that fit your day, one-tap logging, and a streak that rewards showing up.
          </p>
        </div>
      </aside>
    </div>
  );
}
