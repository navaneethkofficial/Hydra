"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useHydration } from "@/hooks/use-hydration";
import { formatVolume } from "@/lib/domain/units";

/**
 * The one moment of celebration in the product.
 *
 * It fires once, on the drink that completes the day, and dismisses itself.
 * Logging carries on afterwards — hitting the target is not the end of tracking.
 */
export function GoalCelebration() {
  const { today, celebrate, dismissCelebration } = useHydration();
  const { progress, profile } = today;

  React.useEffect(() => {
    if (!celebrate) return;
    const timer = window.setTimeout(dismissCelebration, 5000);
    return () => window.clearTimeout(timer);
  }, [celebrate, dismissCelebration]);

  return (
    <Dialog open={celebrate} onOpenChange={(open) => !open && dismissCelebration()}>
      <DialogContent className="max-w-xs text-center">
        <span aria-hidden className="mx-auto text-4xl">
          🎉
        </span>
        <DialogTitle className="mt-4 text-xl">Daily goal complete!</DialogTitle>
        <p className="tabular mt-2 text-sm font-medium text-primary">
          {formatVolume(progress.consumed, profile.unit)} / {formatVolume(progress.goal, profile.unit)}
        </p>
        <DialogDescription className="mt-2">
          You stayed consistent today. Anything more is a bonus.
        </DialogDescription>
        <Button className="mt-6" block onClick={dismissCelebration}>
          Keep going
        </Button>
      </DialogContent>
    </Dialog>
  );
}
