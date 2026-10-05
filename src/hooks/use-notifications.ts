"use client";

import * as React from "react";

import { api } from "@/lib/api-client";

/**
 * Browser notification permission and delivery.
 *
 * The permission prompt is never fired on page load — the UI explains the
 * benefit first and only calls `request()` from a deliberate tap. That is both
 * the respectful order and the one browsers reward: a prompt the user was not
 * expecting is a prompt they permanently block.
 *
 * Permission and the local "dismissed" flag are read through
 * `useSyncExternalStore`, because they are exactly that — state owned by the
 * browser rather than by React.
 */

export type NotificationPermissionState = "unsupported" | "default" | "granted" | "denied";

const DISMISSED_KEY = "hydra.notifications.dismissed";

/** Options browsers support but TypeScript's DOM types have dropped. */
export type ReminderNotificationOptions = NotificationOptions & {
  renotify?: boolean;
  vibrate?: number[];
};

/** Bumped whenever we change permission or dismissal, to re-read the snapshot. */
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners(): void {
  for (const listener of listeners) listener();
}

function readPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as NotificationPermissionState;
}

function readDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function useNotifications() {
  const permission = React.useSyncExternalStore(
    subscribe,
    readPermission,
    () => "unsupported" as const,
  );
  const dismissed = React.useSyncExternalStore(
    subscribe,
    readDismissed,
    () => true,
  );

  const request = React.useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;

    const result = (await Notification.requestPermission()) as NotificationPermissionState;
    notifyListeners();

    if (result === "granted") await registerPushSubscription();
    return result;
  }, []);

  const dismiss = React.useCallback(() => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage unavailable — the prompt simply reappears next visit.
    }
    notifyListeners();
  }, []);

  const notify = React.useCallback(
    async (title: string, options: ReminderNotificationOptions = {}) => {
      if (permission !== "granted") return;

      // Prefer the service worker: its notifications survive the tab closing
      // and can carry actions.
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration) {
        await registration.showNotification(title, {
          badge: "/icons/icon-192.png",
          icon: "/icons/icon-192.png",
          tag: "hydra-reminder",
          // Each reminder replaces the last; without this the replacement
          // arrives without any sound or buzz.
          renotify: true,
          ...options,
        } as ReminderNotificationOptions);
        return;
      }
      new Notification(title, options);
    },
    [permission],
  );

  return {
    permission,
    /** Show the explainer only when asking could still succeed. */
    shouldPrompt: permission === "default" && !dismissed,
    request,
    dismiss,
    notify,
  };
}

/**
 * Registers a push subscription when the deployment has VAPID keys configured.
 * Without them, reminders still work while a tab is open — this is the upgrade
 * path, not a requirement.
 */
async function registerPushSubscription(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!registration || !vapidKey || !("pushManager" in registration)) return;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    await api.post("/api/notifications/subscribe", subscription.toJSON());
  } catch {
    // Push is a bonus channel; failing to register must never break the page.
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = window.atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}
