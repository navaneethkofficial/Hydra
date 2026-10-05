/**
 * Timezone-aware time helpers.
 *
 * Everything the product reasons about — "today", "the awake window", "quiet
 * hours" — is *local* to the user, while every timestamp we persist is UTC.
 * These helpers are the single bridge between the two, so no other module ever
 * has to think about DST or travellers crossing a date line.
 *
 * Pure: no framework, no database, no I/O. Safe on both server and client.
 */

/** Local calendar day, `YYYY-MM-DD`. */
export type DayKey = string;

/** Local wall-clock time of day, `HH:mm`. */
export type TimeOfDay = string;

export const MINUTES_PER_DAY = 24 * 60;

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();
const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function dayKeyFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = dayKeyFormatters.get(timeZone);
  if (!formatter) {
    // `en-CA` renders as YYYY-MM-DD, which is exactly our DayKey shape.
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayKeyFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/** True when `timeZone` is a name this runtime can actually resolve. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Falls back to UTC rather than throwing on a stale or spoofed zone. */
export function safeTimeZone(timeZone: string | null | undefined): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC";
}

/** The local calendar day `instant` falls on, in `timeZone`. */
export function toDayKey(instant: Date, timeZone: string): DayKey {
  return dayKeyFormatter(safeTimeZone(timeZone)).format(instant);
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** Minutes elapsed since local midnight, 0–1439. */
  minutesOfDay: number;
  dayKey: DayKey;
}

/** Decomposes a UTC instant into local wall-clock parts. */
export function toZonedParts(instant: Date, timeZone: string): ZonedParts {
  const zone = safeTimeZone(timeZone);
  const parts = partsFormatter(zone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  const hour = read("hour") % 24;
  const minute = read("minute");
  const year = read("year");
  const month = read("month");
  const day = read("day");

  return {
    year,
    month,
    day,
    hour,
    minute,
    minutesOfDay: hour * 60 + minute,
    dayKey: `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`,
  };
}

/** Minutes since local midnight for `instant`. */
export function minutesOfDay(instant: Date, timeZone: string): number {
  return toZonedParts(instant, timeZone).minutesOfDay;
}

/** `"07:30"` → `450`. Invalid input falls back to `fallback`. */
export function parseTimeOfDay(value: string | null | undefined, fallback = 0): number {
  if (!value) return fallback;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback;
  if (hours > 23 || minutes > 59) return fallback;
  return hours * 60 + minutes;
}

/** `450` → `"07:30"`. Wraps values outside a single day. */
export function formatTimeOfDay(totalMinutes: number): TimeOfDay {
  const wrapped = ((Math.round(totalMinutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${pad(Math.floor(wrapped / 60), 2)}:${pad(wrapped % 60, 2)}`;
}

export function isValidTimeOfDay(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

/**
 * Membership test for a `[start, end)` window that may wrap past midnight —
 * a night-shift worker awake 22:00 → 06:00 is the normal case, not an edge one.
 */
export function isWithinWindow(minute: number, startMinute: number, endMinute: number): boolean {
  if (startMinute === endMinute) return false;
  return startMinute < endMinute
    ? minute >= startMinute && minute < endMinute
    : minute >= startMinute || minute < endMinute;
}

/** Length of a possibly-wrapping window, in minutes. */
export function windowLength(startMinute: number, endMinute: number): number {
  const span = endMinute - startMinute;
  return span > 0 ? span : span + MINUTES_PER_DAY;
}

/** How far `minute` sits into a possibly-wrapping window (clamped to it). */
export function minutesIntoWindow(minute: number, startMinute: number, endMinute: number): number {
  const offset = ((minute - startMinute) % MINUTES_PER_DAY + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return Math.min(offset, windowLength(startMinute, endMinute));
}

/**
 * The UTC instant of a local wall-clock time on `dayKey`.
 *
 * Solved by probing the zone offset rather than assuming one, so it stays
 * correct across DST transitions.
 */
export function zonedTimeToInstant(dayKey: DayKey, minuteOfDay: number, timeZone: string): Date {
  const zone = safeTimeZone(timeZone);
  const [year, month, day] = dayKey.split("-").map(Number);
  const wanted = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, 0, minuteOfDay);

  // Two passes converge even when the first guess lands on a DST boundary.
  let guess = new Date(wanted);
  for (let pass = 0; pass < 2; pass += 1) {
    const offset = zoneOffsetMs(guess, zone);
    const next = new Date(wanted - offset);
    if (next.getTime() === guess.getTime()) break;
    guess = next;
  }
  return guess;
}

/** Offset of `timeZone` from UTC at `instant`, in milliseconds. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = toZonedParts(instant, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  // Ignore sub-minute drift; zone offsets are whole minutes.
  return asUtc - Math.floor(instant.getTime() / 60_000) * 60_000;
}

/** Shifts a day key by whole days. `addDays("2026-03-01", -1) === "2026-02-28"`. */
export function addDays(dayKey: DayKey, days: number): DayKey {
  const [year, month, day] = dayKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1, 2)}-${pad(shifted.getUTCDate(), 2)}`;
}

/** Whole days between two day keys (`to - from`). */
export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((dayKeyToUtc(to).getTime() - dayKeyToUtc(from).getTime()) / 86_400_000);
}

/** Inclusive list of day keys from `from` to `to`. */
export function eachDay(from: DayKey, to: DayKey): DayKey[] {
  const days: DayKey[] = [];
  const total = daysBetween(from, to);
  for (let index = 0; index <= total; index += 1) days.push(addDays(from, index));
  return days;
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(dayKey: DayKey): number {
  return dayKeyToUtc(dayKey).getUTCDay();
}

/** Monday-first index: 0 = Monday … 6 = Sunday. */
export function isoWeekdayIndex(dayKey: DayKey): number {
  return (weekdayOf(dayKey) + 6) % 7;
}

/** The Monday of the week containing `dayKey`. */
export function startOfWeek(dayKey: DayKey): DayKey {
  return addDays(dayKey, -isoWeekdayIndex(dayKey));
}

export function isValidDayKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = dayKeyToUtc(value);
  return !Number.isNaN(parsed.getTime()) && toDayKey(parsed, "UTC") === value;
}

function dayKeyToUtc(dayKey: DayKey): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}

function pad(value: number, length: number): string {
  return String(Math.abs(value)).padStart(length, "0");
}
