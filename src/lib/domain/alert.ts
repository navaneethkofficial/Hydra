/**
 * The reminder alert: which tone, how long, and how it feels in the hand.
 *
 * A tone is declared as data — a rhythm of pitched steps — rather than as code,
 * so one renderer plays every tone, the vibration pattern is derived from the
 * same rhythm the speaker plays (they cannot drift), and the settings screen
 * can describe an alert's length without owning any audio.
 *
 * Pure: no Web Audio, no navigator, no I/O. Safe on the server and testable.
 */

export type AlertToneId = "classic" | "double" | "chime" | "rising";

/** One pitched note inside a single beep. */
export interface AlertStep {
  /** Offset from the start of the beep, in milliseconds. */
  at: number;
  durationMs: number;
  frequencyHz: number;
  /** Relative loudness, 0–1, scaled by the renderer's master gain. */
  gain: number;
}

export interface AlertTone {
  id: AlertToneId;
  label: string;
  description: string;
  waveform: "sine" | "triangle" | "square";
  /** Start-to-start spacing between beeps, including the silence after one. */
  cycleMs: number;
  steps: AlertStep[];
}

/**
 * Four tones, deliberately few.
 *
 * They differ in rhythm as well as pitch, so they stay apart from across a room
 * and for anyone who cannot easily hear the difference between two tones — and
 * because the vibration pattern follows the rhythm, they stay distinguishable
 * through a pocket too.
 */
export const ALERT_TONES: readonly AlertTone[] = [
  {
    id: "classic",
    label: "Classic",
    description: "A steady alarm-clock beep.",
    waveform: "sine",
    cycleMs: 300,
    steps: [{ at: 0, durationMs: 130, frequencyHz: 880, gain: 1 }],
  },
  {
    id: "double",
    label: "Double",
    description: "Two quick chirps, like a digital watch.",
    waveform: "square",
    cycleMs: 420,
    steps: [
      { at: 0, durationMs: 65, frequencyHz: 988, gain: 0.55 },
      { at: 105, durationMs: 65, frequencyHz: 988, gain: 0.55 },
    ],
  },
  {
    id: "chime",
    label: "Chime",
    description: "Two soft bell notes. The gentlest option.",
    waveform: "triangle",
    cycleMs: 620,
    // Its two notes overlap, so their amplitudes sum where they meet. The gain
    // is set low enough that the combined peak still lands below the others —
    // a tone advertised as the gentlest must not measure as the loudest.
    steps: [
      { at: 0, durationMs: 200, frequencyHz: 1175, gain: 0.6 },
      { at: 170, durationMs: 280, frequencyHz: 784, gain: 0.6 },
    ],
  },
  {
    id: "rising",
    label: "Rising",
    description: "Three ascending notes. The hardest to ignore.",
    waveform: "sine",
    cycleMs: 480,
    steps: [
      { at: 0, durationMs: 80, frequencyHz: 659, gain: 1 },
      { at: 85, durationMs: 80, frequencyHz: 880, gain: 1 },
      { at: 170, durationMs: 100, frequencyHz: 1109, gain: 1 },
    ],
  },
] as const;

export const DEFAULT_ALERT_TONE: AlertToneId = "classic";
export const ALERT_TONE_IDS = ALERT_TONES.map((tone) => tone.id) as readonly AlertToneId[];

/** Falls back to the default rather than throwing on an unknown id. */
export function alertTone(id: string | null | undefined): AlertTone {
  return (
    ALERT_TONES.find((tone) => tone.id === id) ??
    ALERT_TONES.find((tone) => tone.id === DEFAULT_ALERT_TONE)!
  );
}

// --- Length -----------------------------------------------------------------

/** Beeps per alert. The dial the user turns. */
export const MIN_ALERT_BEEPS = 1;
export const MAX_ALERT_BEEPS = 30;
export const DEFAULT_ALERT_BEEPS = 10;

export function clampBeeps(beeps: number): number {
  if (!Number.isFinite(beeps)) return DEFAULT_ALERT_BEEPS;
  return Math.min(MAX_ALERT_BEEPS, Math.max(MIN_ALERT_BEEPS, Math.round(beeps)));
}

/** The audible span of one beep — its first note to its last. */
export function beepSpanMs(tone: AlertTone): number {
  return tone.steps.reduce((end, step) => Math.max(end, step.at + step.durationMs), 0);
}

/**
 * How long an alert lasts, in milliseconds.
 *
 * The silence trailing the final beep is not part of the sound, so the number
 * shown in settings matches what the user actually hears.
 */
export function alertDurationMs(beeps: number, toneId?: string | null): number {
  const tone = alertTone(toneId);
  const count = clampBeeps(beeps);
  return (count - 1) * tone.cycleMs + beepSpanMs(tone);
}

/** Label for the settings screen — "10 beeps · about 2.8s". */
export function describeAlert(beeps: number, toneId?: string | null): string {
  const count = clampBeeps(beeps);
  const seconds = Math.round(alertDurationMs(count, toneId) / 100) / 10;
  return `${count} ${count === 1 ? "beep" : "beeps"} · about ${seconds}s`;
}

// --- Vibration --------------------------------------------------------------

/** Nothing shorter than this registers as a buzz on most hardware. */
const MIN_PULSE_MS = 20;

/**
 * The vibration pattern matching an alert, as
 * `[buzz, pause, buzz, pause, …]` for `navigator.vibrate`.
 *
 * Derived from the very same steps the speaker plays, so the buzz lands on the
 * beep rather than near it. Overlapping notes — the two halves of a chime —
 * merge into one continuous pulse instead of a stutter.
 */
export function vibrationPattern(beeps: number, toneId?: string | null): number[] {
  const tone = alertTone(toneId);
  const count = clampBeeps(beeps);

  const spans: Array<[number, number]> = [];
  for (let beep = 0; beep < count; beep += 1) {
    const origin = beep * tone.cycleMs;
    for (const step of tone.steps) {
      const start = origin + step.at;
      spans.push([start, start + Math.max(MIN_PULSE_MS, step.durationMs)]);
    }
  }
  spans.sort((a, b) => a[0] - b[0]);

  // Merge anything overlapping or touching: one pulse, not two with no gap.
  const merged: Array<[number, number]> = [];
  for (const [start, end] of spans) {
    const previous = merged[merged.length - 1];
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else merged.push([start, end]);
  }

  const pattern: number[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    // The array alternates buzz-then-pause, so a leading delay needs a 0 buzz.
    if (start > cursor) {
      if (pattern.length === 0) pattern.push(0);
      pattern.push(Math.round(start - cursor));
    }
    pattern.push(Math.round(end - start));
    cursor = end;
  }
  return pattern;
}
