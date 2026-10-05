"use client";

import * as React from "react";

/**
 * A human countdown to a moment in the future — "in 1 h 20 min", then a live
 * "in 4:32" for the final hour.
 *
 * The current time lives in state rather than being read during render: a
 * component must be able to render twice with the same result, and `Date.now()`
 * inline breaks that. Ticks every second so the final hour counts down live.
 */
export function useCountdown(target: string | null): string | null {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!target) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [target]);

  if (!target) return null;

  const seconds = Math.ceil((new Date(target).getTime() - now) / 1_000);
  // The scheduler rings on the same moment, so this only shows for a blink.
  if (seconds <= 0) return "now";
  if (seconds < 3_600) {
    const minutes = Math.floor(seconds / 60);
    return `in ${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  }

  const minutes = Math.ceil(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours >= 12) return "tomorrow";
  return rest === 0 ? `in ${hours} h` : `in ${hours} h ${rest} min`;
}
