import { Flame } from "lucide-react";

import { HydrationRing } from "@/components/hydration/hydration-ring";
import { cn } from "@/lib/utils";

/**
 * A static rendering of the real dashboard, used beside the hero.
 *
 * It reuses the actual `HydrationRing`, so the promise on the landing page and
 * the product behind it can never drift apart.
 */
export function DashboardPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      {/* A soft pool of colour behind the card, instead of a gradient wash. */}
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-[3rem] bg-primary/[0.07] blur-2xl"
      />

      <div className="w-full max-w-sm rounded-[2rem] border border-border bg-card p-6 shadow-[var(--shadow-lifted)]">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-sm font-medium">Good morning, Alex</p>
            <p className="text-xs text-muted-foreground">Today&rsquo;s hydration</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning-foreground">
            <Flame className="size-3.5" aria-hidden />7
          </span>
        </div>

        <div className="mt-5 flex justify-center">
          <HydrationRing consumed={1500} goal={2500} size={220} animate={false} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <div className="flex h-12 items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">
            + 250 ml
          </div>
          <div className="flex h-12 items-center justify-center rounded-2xl border border-border text-sm font-semibold">
            + 500 ml
          </div>
        </div>

        <div className="mt-5 space-y-2.5 border-t border-border pt-5">
          {[
            { time: "08:15", amount: "250 ml" },
            { time: "09:40", amount: "300 ml" },
            { time: "11:20", amount: "450 ml" },
          ].map((entry) => (
            <div key={entry.time} className="flex items-center gap-3 text-sm">
              <span className="tabular w-11 text-xs text-muted-foreground">{entry.time}</span>
              <span aria-hidden className="size-1.5 rounded-full bg-primary/40" />
              <span className="font-medium">{entry.amount}</span>
            </div>
          ))}
        </div>
      </div>

      {/* The reminder card, peeking out to show the product's actual promise. */}
      <div className="absolute -bottom-6 -left-4 w-60 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-lifted)] sm:-left-10">
        <p className="text-sm font-semibold">💧 Time for a sip</p>
        <p className="mt-1 text-xs text-muted-foreground text-pretty">
          You haven&rsquo;t logged water in a while.
        </p>
        <div className="mt-3 flex h-9 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
          Drink 250 ml
        </div>
      </div>
    </div>
  );
}
