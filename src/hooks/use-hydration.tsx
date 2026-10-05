"use client";

import * as React from "react";
import { toast } from "sonner";

import { computeProgress } from "@/lib/domain/progress";
import { evaluateReminder } from "@/lib/domain/reminder-engine";
import { formatServing } from "@/lib/domain/units";
import { api, ApiClientError } from "@/lib/api-client";
import {
  createClientId,
  enqueue,
  readQueue,
  removeFromQueue,
  type QueuedDrink,
} from "@/lib/offline-queue";
import type { LogWaterResultDto, TodayDto, WaterLogDto } from "@/types/api";

/**
 * The dashboard's state.
 *
 * Three jobs, in priority order:
 *  1. A tap registers instantly — the UI updates before the network is asked.
 *  2. A tap is never lost — a failed write goes to the outbox and replays.
 *  3. The reminder stays live — re-evaluated locally on a timer, so the state
 *     and countdown keep moving without polling the server.
 */

interface HydrationState {
  today: TodayDto;
  pending: number;
  queued: number;
  isSyncing: boolean;
  /** Set when a drink just completed the goal; the UI celebrates once. */
  celebrate: boolean;
}

interface HydrationActions {
  logWater: (amount: number, source?: QueuedDrink["source"]) => Promise<void>;
  removeLog: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  dismissCelebration: () => void;
  /** Records that a reminder just fired, so the next one counts from now. */
  markReminded: () => void;
}

type HydrationValue = HydrationState & HydrationActions;

const HydrationContext = React.createContext<HydrationValue | null>(null);

/** How often the reminder state and countdown are re-derived. */
const CLOCK_INTERVAL_MS = 30_000;

/** Survives a reload, so reopening the app doesn't ring a reminder that already rang. */
const LAST_REMINDER_KEY = "hydra.reminders.lastAt";

function readLastReminderAt(): number | null {
  try {
    const stored = Number(window.localStorage.getItem(LAST_REMINDER_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  } catch {
    return null;
  }
}

export function HydrationProvider({
  initialToday,
  children,
}: {
  initialToday: TodayDto;
  children: React.ReactNode;
}) {
  const [today, setToday] = React.useState(initialToday);
  const [pending, setPending] = React.useState(0);
  const [queued, setQueued] = React.useState(0);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [celebrate, setCelebrate] = React.useState(false);
  const [now, setNow] = React.useState(() => new Date());
  const [lastReminderAt, setLastReminderAt] = React.useState<number | null>(() =>
    typeof window === "undefined" ? null : readLastReminderAt(),
  );

  // Server data replaces client state when the route re-renders (a navigation,
  // or a settings change upstream). React's documented way to reset state from
  // a prop: compare during render, not in an effect.
  const [lastServerData, setLastServerData] = React.useState(initialToday);
  if (initialToday !== lastServerData) {
    setLastServerData(initialToday);
    setToday(initialToday);
  }

  const refresh = React.useCallback(async () => {
    try {
      setToday(await api.get<TodayDto>("/api/hydration/today"));
    } catch {
      // A failed refresh leaves the last good state on screen, which beats an
      // error where the user's progress used to be.
    }
  }, []);

  /** Replays anything the outbox is holding. Safe to call repeatedly. */
  const flushQueue = React.useCallback(async () => {
    const entries = readQueue();
    setQueued(entries.length);
    if (entries.length === 0) return;

    setIsSyncing(true);
    try {
      const result = await api.post<{ today: TodayDto; accepted: number }>(
        "/api/hydration/log/batch",
        { entries },
      );
      removeFromQueue(entries.map((entry) => entry.clientId));
      setQueued(0);
      setToday(result.today);
      if (result.accepted > 0) {
        toast.success("Back online", {
          description: `${result.accepted} ${result.accepted === 1 ? "drink" : "drinks"} synced.`,
        });
      }
    } catch {
      // Still offline, or the server is unhappy — the outbox keeps holding it.
    } finally {
      setIsSyncing(false);
    }
  }, []);

  React.useEffect(() => {
    void flushQueue();

    const onOnline = () => void flushQueue();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flushQueue]);

  // The clock that keeps the reminder state and countdown honest, without
  // polling the server for something both sides can compute.
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), CLOCK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const logWater = React.useCallback(
    // Named so the retry action can call it without depending on the binding.
    async function log(amount: number, source: QueuedDrink["source"] = "QUICK_ADD"): Promise<void> {
      const entry: QueuedDrink = {
        clientId: createClientId(),
        amount,
        loggedAt: new Date().toISOString(),
        source,
      };

      const optimisticLog: WaterLogDto = {
        id: `optimistic-${entry.clientId}`,
        amount,
        loggedAt: entry.loggedAt,
        source,
      };

      // 1. Show it immediately.
      setToday((current) => applyOptimisticLog(current, optimisticLog));
      setPending((count) => count + 1);

      try {
        // 2. Persist it.
        const result = await api.post<LogWaterResultDto>("/api/hydration/log", {
          amount,
          source,
          loggedAt: entry.loggedAt,
          clientId: entry.clientId,
        });

        setToday((current) => reconcile(current, optimisticLog.id, result));
        if (result.goalJustCompleted) setCelebrate(true);
      } catch (error) {
        if (error instanceof ApiClientError && error.isRetryable) {
          // 3. Keep the optimistic state and replay when the network returns.
          enqueue(entry);
          setQueued((count) => count + 1);
          toast("Saved on this device", {
            description: "We'll sync this drink when you're back online.",
          });
        } else {
          // Remove just this drink rather than restoring a whole snapshot, so a
          // concurrent tap that succeeded is not undone along with it.
          setToday((current) => removeLogLocally(current, optimisticLog.id));
          toast.error("Something went wrong while saving your drink.", {
            description: error instanceof Error ? error.message : undefined,
            action: { label: "Try again", onClick: () => void log(amount, source) },
          });
        }
      } finally {
        setPending((count) => Math.max(0, count - 1));
      }
    },
    [],
  );

  const removeLog = React.useCallback(async (id: string) => {
    let restore: WaterLogDto | undefined;
    setToday((current) => {
      restore = current.logs.find((log) => log.id === id);
      return removeLogLocally(current, id);
    });

    try {
      setToday(await api.delete<TodayDto>(`/api/hydration/log/${id}`));
      toast("Drink removed");
    } catch (error) {
      // Put it back exactly where it was; the user's data is never dropped.
      if (restore) {
        const recovered = restore;
        setToday((current) => applyOptimisticLog(current, recovered));
      }
      toast.error("We couldn't remove that drink.", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }, []);

  const dismissCelebration = React.useCallback(() => setCelebrate(false), []);

  const markReminded = React.useCallback(() => {
    const at = Date.now();
    setLastReminderAt(at);
    setNow(new Date(at));
    try {
      window.localStorage.setItem(LAST_REMINDER_KEY, String(at));
    } catch {
      // Storage unavailable — worst case, a reload rings once more.
    }
  }, []);

  /**
   * The reminder as of *now*, not as of the last fetch. Recomputed from the
   * same pure engine and the same learned weights the server used, so the two
   * can never disagree.
   */
  const liveToday = React.useMemo<TodayDto>(() => {
    const lastLog = today.logs[today.logs.length - 1];
    const plan = evaluateReminder({
      now,
      timezone: today.timezone,
      goal: today.profile.dailyGoal,
      consumed: today.progress.consumed,
      lastDrinkAt: lastLog ? new Date(lastLog.loggedAt) : null,
      lastReminderAt: lastReminderAt ? new Date(lastReminderAt) : null,
      wakeTime: today.profile.wakeTime,
      sleepTime: today.profile.sleepTime,
      defaultServing: today.profile.defaultServing,
      preferences: today.settings,
      hourlyPattern: today.reminder.hourlyPattern,
      patternDays: today.reminder.patternDays,
    });

    return {
      ...today,
      reminder: {
        ...today.reminder,
        state: plan.state,
        headline: plan.headline,
        body: plan.body,
        ctaLabel: plan.ctaLabel,
        suggestedAmount: plan.suggestedAmount,
        expected: plan.expected,
        deficit: plan.deficit,
        nextReminderAt: plan.nextReminderAt?.toISOString() ?? null,
        shouldNotify: plan.shouldNotify,
        minutesSinceLastDrink: plan.minutesSinceLastDrink,
        resting: plan.resting,
      },
    };
  }, [today, now, lastReminderAt]);

  const value: HydrationValue = {
    today: liveToday,
    pending,
    queued,
    isSyncing,
    celebrate,
    logWater,
    removeLog,
    refresh,
    dismissCelebration,
    markReminded,
  };

  return <HydrationContext.Provider value={value}>{children}</HydrationContext.Provider>;
}

export function useHydration(): HydrationValue {
  const context = React.useContext(HydrationContext);
  if (!context) throw new Error("useHydration must be used inside <HydrationProvider>.");
  return context;
}

/** Convenience for log buttons: "+250 ml" copy in the user's unit. */
export function useServingLabel(): (ml: number) => string {
  const { today } = useHydration();
  return React.useCallback(
    (ml: number) => formatServing(ml, today.profile.unit),
    [today.profile.unit],
  );
}

// ---------------------------------------------------------------------------

/**
 * Inserts a drink in chronological order — a restored or backdated log lands
 * where it happened, not at the end of the list.
 */
function applyOptimisticLog(current: TodayDto, log: WaterLogDto): TodayDto {
  const logs = [...current.logs, log].sort(
    (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime(),
  );

  return {
    ...current,
    logs,
    progress: computeProgress(current.progress.consumed + log.amount, current.progress.goal),
  };
}

/** Swaps the placeholder for the server's row and adopts its derived state. */
function reconcile(current: TodayDto, optimisticId: string, result: LogWaterResultDto): TodayDto {
  return {
    ...current,
    logs: current.logs.map((log) => (log.id === optimisticId ? result.log : log)),
    progress: result.progress,
    streak: result.streak,
    reminder: result.reminder,
  };
}

function removeLogLocally(current: TodayDto, id: string): TodayDto {
  const target = current.logs.find((log) => log.id === id);
  if (!target) return current;

  return {
    ...current,
    logs: current.logs.filter((log) => log.id !== id),
    progress: computeProgress(current.progress.consumed - target.amount, current.progress.goal),
  };
}
