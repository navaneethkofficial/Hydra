"use client";

import { BellOff, Clock, Droplet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCountdown } from "@/hooks/use-countdown";
import { useHydration } from "@/hooks/use-hydration";
import { formatServing } from "@/lib/domain/units";
import type { ReminderState } from "@/lib/domain/reminder-engine";
import { cn } from "@/lib/utils";

/**
 * The reminder, as the user sees it.
 *
 * Every state gets the same layout and a different tone, so glancing at this
 * card answers "am I fine?" without reading a word of it. No state scolds.
 */

const TONE: Record<ReminderState, { accent: string; icon: string }> = {
  ON_TRACK: { accent: "bg-success-soft text-success", icon: "💧" },
  FALLING_BEHIND: { accent: "bg-warning-soft text-warning-foreground", icon: "⏳" },
  INACTIVE: { accent: "bg-primary-soft text-primary", icon: "💧" },
  GOAL_MET: { accent: "bg-success-soft text-success", icon: "🎉" },
  RESTING: { accent: "bg-secondary text-muted-foreground", icon: "🌙" },
};

export function ReminderCard() {
  const { today, logWater } = useHydration();
  const { reminder, profile } = today;
  const countdown = useCountdown(reminder.nextReminderAt);
  const tone = TONE[reminder.state];

  const showCta = reminder.state === "FALLING_BEHIND" || reminder.state === "INACTIVE";

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-lg", tone.accent)}
        >
          {tone.icon}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{reminder.headline}</h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">{reminder.body}</p>

          {showCta && (
            <Button
              size="sm"
              variant="soft"
              className="mt-3.5"
              onClick={() => void logWater(reminder.suggestedAmount, "REMINDER")}
            >
              <Droplet aria-hidden />
              Drink {formatServing(reminder.suggestedAmount, profile.unit)}
            </Button>
          )}
        </div>
      </div>

      <p
        className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground tabular-nums"
        // The countdown ticks by the second, so server and client never agree on it.
        suppressHydrationWarning
      >
        {reminder.enabled ? (
          <>
            <Clock className="size-3.5" aria-hidden />
            {countdown ? `Next reminder ${countdown}` : "No more reminders today"}
          </>
        ) : (
          <>
            <BellOff className="size-3.5" aria-hidden />
            Reminders are off — turn them on in your profile.
          </>
        )}
      </p>
    </Card>
  );
}
