"use client";

import * as React from "react";

import { useHydration } from "@/hooks/use-hydration";
import { formatServing } from "@/lib/domain/units";

const ENCOURAGEMENTS = [
  "Nice! Keep going.",
  "That's the habit.",
  "Well timed.",
  "Good one.",
] as const;

/**
 * The acknowledgement after a tap: a droplet that rises and fades.
 *
 * Deliberately small and short — the confirmation the user actually needs is
 * the ring moving. This is the accent on top, and it disables itself for anyone
 * who has asked for reduced motion (see `globals.css`).
 */
export function DrinkFeedback() {
  const { today } = useHydration();
  const { logs, profile } = today;

  const latest = logs[logs.length - 1];
  const [shown, setShown] = React.useState<{ key: string; label: string; note: string } | null>(null);
  const seen = React.useRef<string | null>(latest?.id ?? null);

  React.useEffect(() => {
    if (!latest || latest.id === seen.current) return;
    seen.current = latest.id;

    setShown({
      key: latest.id,
      label: `+${formatServing(latest.amount, profile.unit)}`,
      note: ENCOURAGEMENTS[logs.length % ENCOURAGEMENTS.length] ?? ENCOURAGEMENTS[0],
    });

    const timer = window.setTimeout(() => setShown(null), 950);
    return () => window.clearTimeout(timer);
  }, [latest, logs.length, profile.unit]);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-2 flex justify-center"
    >
      {shown && (
        <span
          key={shown.key}
          className="animate-[var(--animate-drop)] rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-lifted)]"
        >
          {shown.label} 💧 {shown.note}
        </span>
      )}
    </div>
  );
}
