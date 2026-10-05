"use client";

import { Bell, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNotifications } from "@/hooks/use-notifications";

/**
 * Asks for notification permission — but only after explaining why.
 *
 * The browser prompt is fired from the user's tap on "Turn on reminders", never
 * on page load. A permission dismissed out of surprise is denied forever.
 */
export function NotificationPrompt() {
  const { shouldPrompt, request, dismiss } = useNotifications();
  if (!shouldPrompt) return null;

  return (
    <Card className="relative border-primary/25 bg-primary-soft/50 p-5">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={dismiss}
        aria-label="Dismiss reminder setup"
        className="absolute right-3 top-3"
      >
        <X />
      </Button>

      <div className="flex items-start gap-3.5 pr-8">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-card">
          <Bell className="size-5 text-primary" />
        </span>

        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Get gentle reminders when it&rsquo;s time for a sip.</h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Only inside your waking hours, never while you&rsquo;re asleep, and never right after
            you&rsquo;ve just had water.
          </p>
          <Button size="sm" className="mt-3.5" onClick={() => void request()}>
            Turn on reminders
          </Button>
        </div>
      </div>
    </Card>
  );
}
