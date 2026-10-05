import { getSessionUser } from "@/server/auth/session";
import { Hero } from "@/components/marketing/hero";
import {
  ConsistencySection,
  CtaSection,
  InsightsSection,
  ProblemSection,
  ProgressSection,
  RemindersSection,
  SolutionSection,
} from "@/components/marketing/sections";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

/**
 * The landing page.
 *
 * Rendered on the server with only one piece of dynamic state — whether the
 * visitor is signed in, which changes every call to action from "start" to
 * "open my dashboard".
 */
export default async function LandingPage() {
  const user = await getSessionUser();
  const signedIn = user !== null;

  return (
    <div className="min-h-dvh">
      <SiteHeader signedIn={signedIn} />
      <main id="main">
        <Hero signedIn={signedIn} />
        <ProblemSection />
        <SolutionSection />
        <RemindersSection />
        <ProgressSection />
        <ConsistencySection />
        <InsightsSection />
        <CtaSection signedIn={signedIn} />
      </main>
      <SiteFooter />
    </div>
  );
}
