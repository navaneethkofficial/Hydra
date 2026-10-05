"use client";

import * as React from "react";

import { unlockAlertAudio } from "@/lib/alert-sound";

/**
 * Opens the audio channel on the user's first interaction with the page.
 *
 * A reminder fires from a timer, and browsers will not let a timer start audio
 * on its own. Any tap on the dashboard — including the log button people press
 * anyway — is enough to license every later alert, so this costs the user
 * nothing and asks them for nothing.
 */
export function useAudioUnlock(): void {
  React.useEffect(() => {
    const unlock = () => unlockAlertAudio();
    const events = ["pointerdown", "keydown"] as const;

    for (const event of events) {
      window.addEventListener(event, unlock, { once: true, passive: true });
    }
    return () => {
      for (const event of events) window.removeEventListener(event, unlock);
    };
  }, []);
}
