"use client";

import { Vibrate } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { useHydrated } from "@/hooks/use-hydrated";
import { supportsVibration } from "@/lib/alert-sound";

/**
 * The vibration switch.
 *
 * Its own component purely so the hint can tell the truth: whether this device
 * can buzz is only knowable in the browser, and a toggle that silently does
 * nothing is worse than one that says so.
 */
export function VibrationRow({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const hydrated = useHydrated();
  const canVibrate = hydrated && supportsVibration();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor="vibration" className="flex items-center gap-2 text-sm font-medium">
          <Vibrate className="size-4 text-muted-foreground" aria-hidden />
          Vibrate
        </label>
        <p id="vibration-hint" className="mt-0.5 text-xs text-muted-foreground text-pretty">
          {canVibrate
            ? "Buzzes in time with the beeps."
            : "This device doesn't support vibration, so this has no effect here."}
        </p>
      </div>
      <Switch
        id="vibration"
        checked={enabled}
        onCheckedChange={onChange}
        aria-describedby="vibration-hint"
      />
    </div>
  );
}
