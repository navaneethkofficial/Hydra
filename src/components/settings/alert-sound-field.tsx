"use client";

import * as React from "react";
import { Play, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { playAlert, stopAlert, unlockAlertAudio } from "@/lib/alert-sound";
import {
  ALERT_TONES,
  clampBeeps,
  describeAlert,
  MAX_ALERT_BEEPS,
  MIN_ALERT_BEEPS,
  type AlertToneId,
} from "@/lib/domain/alert";
import { cn } from "@/lib/utils";

/**
 * Tone and length.
 *
 * Both are things you experience rather than numbers you reason about, so every
 * control here is audible on the spot: picking a tone plays a two-beep taste of
 * it, and the preview button plays the full alert exactly as a real reminder
 * will. Those taps are also the user gesture that licenses audio and vibration
 * for reminders later.
 */

/** Short enough to audition without becoming annoying to click through. */
const AUDITION_BEEPS = 2;

export interface AlertSoundFieldProps {
  tone: AlertToneId;
  beeps: number;
  vibration: boolean;
  soundEnabled: boolean;
  onToneChange: (tone: AlertToneId) => void;
  onBeepsChange: (beeps: number) => void;
}

export function AlertSoundField({
  tone,
  beeps,
  vibration,
  soundEnabled,
  onToneChange,
  onBeepsChange,
}: AlertSoundFieldProps) {
  const [isPlaying, setIsPlaying] = React.useState(false);

  // A preview must never outlive the screen that started it.
  React.useEffect(() => stopAlert, []);

  const audition = (next: AlertToneId) => {
    unlockAlertAudio();
    onToneChange(next);
    stopAlert();
    void playAlert({
      beeps: AUDITION_BEEPS,
      tone: next,
      sound: soundEnabled,
      vibrate: vibration,
    });
  };

  const preview = async () => {
    if (isPlaying) {
      stopAlert();
      setIsPlaying(false);
      return;
    }

    unlockAlertAudio();
    setIsPlaying(true);
    await playAlert({ beeps, tone, sound: soundEnabled, vibrate: vibration });
    setIsPlaying(false);
  };

  return (
    <div className="space-y-5">
      {/* Real radio inputs, so arrow-key navigation and screen-reader
          semantics come from the platform rather than being re-implemented. */}
      <fieldset className="space-y-2.5">
        <legend className="mb-2.5 text-sm font-medium">Alert tone</legend>

        {ALERT_TONES.map((option) => {
          const selected = option.id === tone;
          return (
            <label
              key={option.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors",
                selected ? "border-primary bg-primary-soft" : "border-border hover:bg-secondary",
              )}
            >
              <input
                type="radio"
                name="alertTone"
                value={option.id}
                checked={selected}
                onChange={() => audition(option.id)}
                className="size-4 shrink-0 accent-[var(--color-primary)]"
              />

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.description}</span>
              </span>

              <Play className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="sr-only">Selecting this tone plays a preview</span>
            </label>
          );
        })}
      </fieldset>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor="soundBeeps">Alert length</Label>
          <span className="tabular text-sm font-medium text-muted-foreground">
            {describeAlert(beeps, tone)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Slider
            id="soundBeeps"
            min={MIN_ALERT_BEEPS}
            max={MAX_ALERT_BEEPS}
            step={1}
            value={[clampBeeps(beeps)]}
            onValueChange={([value]) => onBeepsChange(clampBeeps(value ?? beeps))}
            aria-label="Alert length in beeps"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => void preview()}
            aria-label={
              isPlaying ? "Stop the preview" : `Preview the full alert — ${describeAlert(beeps, tone)}`
            }
          >
            {isPlaying ? <Square /> : <Play />}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-pretty">
        Alerts play while Hydra is open in a tab. Notifications still arrive when it isn&rsquo;t —
        quietly, using your system&rsquo;s own sound.
      </p>
    </div>
  );
}
