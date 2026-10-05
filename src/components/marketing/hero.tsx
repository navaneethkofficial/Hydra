import Link from "next/link";
import { ArrowRight, Bell, Check } from "lucide-react";

import { DashboardPreview } from "./dashboard-preview";
import { Button } from "@/components/ui/button";

export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden pb-24 pt-14 sm:pb-32 sm:pt-20">
      <div className="container-page grid items-center gap-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
            <Bell className="size-3.5 text-primary" aria-hidden />
            Reminders that adapt to your day
          </p>

          <h1 className="mt-6 text-balance text-[2.75rem] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-6xl">
            Drink water.
            <br />
            <span className="text-primary">Without having to remember.</span>
          </h1>

          <p className="mt-6 text-pretty text-lg leading-relaxed text-muted-foreground">
            A simple hydration companion that reminds you when to drink, tracks your progress, and
            helps you build a consistent daily habit.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="sm:w-auto">
              <Link href={signedIn ? "/today" : "/register"}>
                {signedIn ? "Open my dashboard" : "Start my hydration journey"}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>

          <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2.5">
            {["Free to start", "One-tap logging", "Works offline"].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="size-4 text-success" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-center lg:justify-end">
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}
