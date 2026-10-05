"use client";

/**
 * The offline outbox.
 *
 * Logging water must work on a train, in a lift, on hotel wifi. A drink the
 * user taps is written to `localStorage` first and flushed when the network
 * comes back, so the tap is never lost and never depends on a round trip.
 *
 * Each entry carries a `clientId`; the API is idempotent on it, so replaying a
 * flush that half-succeeded cannot double-count anyone's water.
 */

const STORAGE_KEY = "hydra.outbox.v1";
const MAX_ENTRIES = 100;

export interface QueuedDrink {
  clientId: string;
  amount: number;
  loggedAt: string;
  source: "MANUAL" | "REMINDER" | "QUICK_ADD";
}

export function createClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function readQueue(): QueuedDrink[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedDrink[]) : [];
  } catch {
    // Private mode, quota, or corrupt data — an empty outbox is the safe answer.
    return [];
  }
}

export function enqueue(entry: QueuedDrink): void {
  writeQueue([...readQueue(), entry].slice(-MAX_ENTRIES));
}

export function removeFromQueue(clientIds: readonly string[]): void {
  const removed = new Set(clientIds);
  writeQueue(readQueue().filter((entry) => !removed.has(entry.clientId)));
}

export function clearQueue(): void {
  writeQueue([]);
}

function writeQueue(entries: QueuedDrink[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Nothing useful to do if storage is unavailable; the in-memory state still
    // reflects the tap for this session.
  }
}
