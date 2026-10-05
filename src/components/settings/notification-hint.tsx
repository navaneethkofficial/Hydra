"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";

/**
 * Explains the current browser permission, since a reminder toggle that is on
 * while the browser is blocking notifications would otherwise be a quiet lie.
 */
export function NotificationSettingsHint() {
  const { permission, request } = useNotifications();

  if (permission === "granted") {
    return <Alert tone="success">Browser notifications are on for this device.</Alert>;
  }

  if (permission === "denied") {
    return (
      <Alert tone="info">
        Your browser is blocking notifications for Hydra. You can re-enable them in the site
        settings for this page.
      </Alert>
    );
  }

  if (permission === "unsupported") {
    return (
      <Alert tone="info">
        This browser doesn&rsquo;t support notifications, so reminders will show in the app instead.
      </Alert>
    );
  }

  return (
    <div className="rounded-xl bg-primary-soft/60 p-4">
      <p className="text-sm text-pretty">
        Get gentle reminders when it&rsquo;s time for a sip.
      </p>
      <Button size="sm" className="mt-3" onClick={() => void request()}>
        Allow notifications
      </Button>
    </div>
  );
}
