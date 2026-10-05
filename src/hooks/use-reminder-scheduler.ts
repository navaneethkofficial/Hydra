"use client";

import * as React from "react";

import { playAlert } from "@/lib/alert-sound";
import { vibrationPattern } from "@/lib/domain/alert";
import { useHydration } from "./use-hydration";
import { useNotifications } from "./use-notifications";

/**
 * Fires the reminder the engine asked for, the moment the countdown ends.
 *
 * The engine decides *whether* and *when*; this hook only delivers — the alarm
 * (sound and/or vibration) plus a system notification when permission allows.
 * Firing records the moment, which moves the engine's next reminder one
 * interval out, so each scheduled moment rings exactly once.
 */
export function useReminderScheduler(): void {
  const { today, markReminded } = useHydration();
  const { permission, notify } = useNotifications();

  const { reminder, profile, settings } = today;
  const due = reminder.nextReminderAt ? new Date(reminder.nextReminderAt).getTime() : null;
  const armed = reminder.enabled && reminder.shouldNotify && due !== null;

  // Everything the delivery needs, kept current without re-arming the timer.
  const deliver = React.useRef<() => void>(() => {});
  React.useEffect(() => {
    deliver.current = () => {
      markReminded();

      // On track gets a gentle nudge; behind or idle gets the engine's own copy.
      const title = reminder.state === "ON_TRACK" ? "Time for a sip" : reminder.headline;
      const body =
        reminder.state === "ON_TRACK" ? "A quick drink keeps your pace steady." : reminder.body;

      if (permission === "granted") {
        // Browsers block in-page vibration while the app is in the background,
        // so there the notification itself has to buzz — which means it can't
        // be silent, even if that lets the OS chime alongside our beeps.
        const notificationBuzzes = settings.vibrationEnabled && document.hidden;
        void notify(`💧 ${title}`, {
          body,
          data: { amount: reminder.suggestedAmount, unit: profile.unit },
          // Our own beeps are the audible channel; the OS chime would double up.
          silent: settings.soundEnabled && !notificationBuzzes,
          ...(notificationBuzzes && {
            vibrate: vibrationPattern(settings.soundBeeps, settings.soundTone),
          }),
        });
      }

      // The alarm doesn't depend on notification permission — an open tab can
      // always ring. Sound and vibration are separate channels.
      if (settings.soundEnabled || settings.vibrationEnabled) {
        void playAlert({
          beeps: settings.soundBeeps,
          tone: settings.soundTone,
          sound: settings.soundEnabled,
          vibrate: settings.vibrationEnabled,
        });
      }
    };
  });

  // One timer, aimed at the exact moment the countdown hits zero.
  React.useEffect(() => {
    if (!armed || due === null) return;
    const timer = window.setTimeout(() => deliver.current(), Math.max(0, due - Date.now()));
    return () => window.clearTimeout(timer);
  }, [armed, due]);
}
