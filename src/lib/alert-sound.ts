"use client";

import {
  alertDurationMs,
  alertTone,
  clampBeeps,
  vibrationPattern,
  type AlertToneId,
} from "@/lib/domain/alert";

/**
 * Playback for the reminder alert.
 *
 * Synthesised with the Web Audio API rather than shipped as audio files: four
 * tones cost no extra requests, nothing to cache, and it all works offline like
 * the rest of the app. This module only *renders* what `domain/alert.ts`
 * declares — the rhythm, pitches and vibration pattern are decided there.
 */

const MASTER_GAIN = 0.16;
/** Ramp in and out of each note, or the edges click audibly. */
const ATTACK_S = 0.008;
const RELEASE_S = 0.05;

let context: AudioContext | null = null;
/** Scheduled oscillators, kept so an alert in progress can be cut short. */
let voices: OscillatorNode[] = [];

export interface AlertOptions {
  beeps: number;
  tone?: AlertToneId | string | null;
  /** Play the tone through the speaker. */
  sound?: boolean;
  /** Buzz the device, where it supports it. Independent of `sound`. */
  vibrate?: boolean;
}

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const Ctor =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  context ??= new Ctor();
  return context;
}

/**
 * Prepares the audio context while a user gesture is in progress.
 *
 * Browsers refuse to start audio — or vibration — that no interaction asked
 * for, and a reminder fires from a timer minutes later, far too late to count.
 * So the channel is opened on the user's first tap and is then allowed to play
 * whenever the engine decides a nudge is due.
 */
export function unlockAlertAudio(): void {
  const ctx = audioContext();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

/** True once the browser will actually let us make a sound. */
export function isAlertAudioReady(): boolean {
  return context !== null && context.state === "running";
}

/** Whether this device can buzz at all — drives the settings copy. */
export function supportsVibration(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/**
 * Plays an alert, resolving when the last beep has finished.
 *
 * Safe to call when audio is unavailable or still locked — it resolves quietly
 * rather than throwing, because a missing sound must never stop the
 * notification itself from being delivered.
 */
export async function playAlert({
  beeps,
  tone: toneId,
  sound = true,
  vibrate = false,
}: AlertOptions): Promise<void> {
  const tone = alertTone(toneId);
  const count = clampBeeps(beeps);

  // Vibration is independent of audio: it still works on a silenced phone, and
  // it must not wait on an audio context that may never unlock. Someone who
  // wants buzz without beeps gets the full rhythm either way.
  if (vibrate) startVibration(count, tone.id);
  if (!sound) {
    await new Promise((resolve) => setTimeout(resolve, alertDurationMs(count, tone.id)));
    return;
  }

  const ctx = audioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return; // Still locked: the visual notification carries the reminder.
    }
  }
  if (ctx.state !== "running") return;

  stopSound();

  const startAt = ctx.currentTime + 0.02;
  for (let beep = 0; beep < count; beep += 1) {
    const origin = startAt + (beep * tone.cycleMs) / 1000;

    for (const step of tone.steps) {
      const noteAt = origin + step.at / 1000;
      const endAt = noteAt + step.durationMs / 1000;
      const peak = MASTER_GAIN * step.gain;
      // A very short note has no room for the full attack and release.
      const release = Math.min(RELEASE_S, (endAt - noteAt) / 2);

      const oscillator = ctx.createOscillator();
      oscillator.type = tone.waveform;
      oscillator.frequency.setValueAtTime(step.frequencyHz, noteAt);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, noteAt);
      gain.gain.linearRampToValueAtTime(peak, noteAt + Math.min(ATTACK_S, release));
      gain.gain.setValueAtTime(peak, endAt - release);
      gain.gain.linearRampToValueAtTime(0, endAt);

      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(noteAt);
      oscillator.stop(endAt);
      oscillator.onended = () => {
        voices = voices.filter((voice) => voice !== oscillator);
      };
      voices.push(oscillator);
    }
  }

  await new Promise((resolve) => setTimeout(resolve, alertDurationMs(count, tone.id) + 40));
}

/** Cuts an alert short — when a new one starts, or a preview is replayed. */
export function stopAlert(): void {
  stopSound();
  if (supportsVibration()) navigator.vibrate(0);
}

function stopSound(): void {
  for (const voice of voices) {
    try {
      voice.stop();
    } catch {
      // Already stopped; nothing to do.
    }
  }
  voices = [];
}

function startVibration(beeps: number, toneId: AlertToneId): void {
  if (!supportsVibration()) return;
  try {
    // One call carries the whole pattern, so the buzz cannot drift out of step
    // with audio that was scheduled ahead on the audio clock.
    navigator.vibrate(vibrationPattern(beeps, toneId));
  } catch {
    // Some browsers refuse without user activation; the sound still plays.
  }
}
