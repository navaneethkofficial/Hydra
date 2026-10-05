"use client";

import { Check, Flame } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useHydration } from "@/hooks/use-hydration";
import { cn } from "@/lib/utils";

/**
 * Streak and the last seven days.
 *
 * A missed day is drawn as an empty ring rather than a cross — the difference
 * between "you didn't do it" and "you failed" is the whole tone of the product.
 */
export function StreakCard() {
  const { streak } = useHydration().today;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3.5">
        <span
          aria-hidden
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-2xl",
            streak.current > 0 ? "bg-warning-soft" : "bg-secondary",
          )}
        >
          <Flame
            className={cn("size-5", streak.current > 0 ? "text-warning" : "text-muted-foreground")}
          />
        </span>

        <div className="min-w-0">
          <p className="flex items-baseline gap-1.5">
            <span className="tabular text-3xl font-semibold leading-none">{streak.current}</span>
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              day streak
            </span>
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground text-pretty">{streak.message}</p>
        </div>
      </div>

      <ul className="mt-5 grid grid-cols-7 gap-1.5">
        {streak.week.map((day) => (
          <li key={day.date} className="text-center">
            <span className="block text-[10px] font-medium text-muted-foreground">{day.label}</span>
            <span
              className={cn(
                "mx-auto mt-1.5 grid size-8 place-items-center rounded-xl border transition-colors",
                day.completed
                  ? "border-transparent bg-success-soft text-success"
                  : "border-dashed border-border text-transparent",
                day.isToday && !day.completed && "border-solid border-primary/50 bg-primary-soft",
              )}
            >
              {day.completed ? <Check className="size-4" aria-hidden /> : null}
              <span className="sr-only">
                {day.label}: {day.completed ? "goal reached" : day.isToday ? "in progress" : "not reached"}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-center">
        <div>
          <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Best streak</dt>
          <dd className="tabular mt-1 text-sm font-semibold">{streak.longest} days</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Consistency</dt>
          <dd className="tabular mt-1 text-sm font-semibold">{streak.consistency}%</dd>
        </div>
      </dl>
    </Card>
  );
}
