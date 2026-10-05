"use client";

import { CloudOff, RefreshCw } from "lucide-react";

import { DrinkFeedback } from "./drink-feedback";
import { GoalCelebration } from "./goal-celebration";
import { HydrationRing } from "./hydration-ring";
import { NotificationPrompt } from "./notification-prompt";
import { QuickAdd } from "./quick-add";
import { ReminderCard } from "./reminder-card";
import { StreakCard } from "./streak-card";
import { TodayTimeline } from "./today-timeline";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useAudioUnlock } from "@/hooks/use-audio-unlock";
import { useHydration } from "@/hooks/use-hydration";
import { useReminderScheduler } from "@/hooks/use-reminder-scheduler";
import { formatVolume } from "@/lib/domain/units";

/**
 * The dashboard.
 *
 * Laid out so the answer to "where am I?" is the first thing on screen and the
 * log button is the second — on any width, without scrolling.
 */
export function TodayView() {
  const { today, queued, isSyncing } = useHydration();
  const { progress, profile, greeting } = today;

  // Delivers whatever the reminder engine has decided is due.
  useReminderScheduler();
  // Licenses the alert tone off the user's first tap — including the log button
  // they were going to press anyway.
  useAudioUnlock();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {greeting} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Today&rsquo;s hydration</p>
        </div>

        {queued > 0 && (
          <Badge variant="warning">
            {isSyncing ? (
              <RefreshCw className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <CloudOff className="size-3.5" aria-hidden />
            )}
            {queued} waiting to sync
          </Badge>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-6">
          <Card className="relative overflow-hidden p-6 sm:p-8">
            <DrinkFeedback />

            <div className="flex flex-col items-center">
              <HydrationRing
                consumed={progress.consumed}
                goal={progress.goal}
                unit={profile.unit}
                size={264}
                className="max-sm:scale-95"
              />

              <p className="mt-4 text-sm text-muted-foreground text-pretty">
                {progress.completed
                  ? `Goal reached — ${formatVolume(progress.consumed, profile.unit)} today.`
                  : `${formatVolume(progress.remaining, profile.unit)} to go.`}
              </p>
            </div>

            <div className="mx-auto mt-7 max-w-sm">
              <QuickAdd />
            </div>
          </Card>

          <div className="lg:hidden">
            <ReminderCard />
          </div>

          <NotificationPrompt />
          <TodayTimeline />
        </div>

        <aside className="space-y-6">
          <div className="max-lg:hidden">
            <ReminderCard />
          </div>
          <StreakCard />
        </aside>
      </div>

      <GoalCelebration />
    </div>
  );
}
