"use client";

import { formatVolume, type Unit } from "@/lib/domain/units";

/**
 * When you drink, across the day.
 *
 * A single-series distribution: 24 thin columns in one hue, heights relative to
 * the busiest hour. No per-bar labels — the shape is the message, and the exact
 * numbers live in the hover title and the screen-reader summary.
 */
export function HourlyChart({ hourly, unit }: { hourly: readonly number[]; unit: Unit }) {
  const peak = Math.max(...hourly, 1);
  const total = hourly.reduce((sum, value) => sum + value, 0);

  if (total === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground text-pretty">
        Once you&rsquo;ve logged a few days, your daily rhythm shows up here.
      </p>
    );
  }

  return (
    <figure>
      <div className="flex h-28 items-end gap-[3px]" role="img" aria-label={describe(hourly, unit)}>
        {hourly.map((amount, hour) => (
          <div
            key={hour}
            className="flex-1 rounded-t-[4px] bg-primary/75 transition-colors hover:bg-primary"
            style={{ height: `${Math.max((amount / peak) * 100, 2)}%` }}
            title={`${hourLabel(hour)} — ${formatVolume(amount, unit)}`}
          />
        ))}
      </div>

      <figcaption className="mt-2.5 flex justify-between text-[11px] text-muted-foreground">
        {["12 AM", "6 AM", "12 PM", "6 PM", "11 PM"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </figcaption>
    </figure>
  );
}

function describe(hourly: readonly number[], unit: Unit): string {
  const peakHour = hourly.indexOf(Math.max(...hourly));
  const total = hourly.reduce((sum, value) => sum + value, 0);
  return `Water logged by hour of day. Busiest around ${hourLabel(peakHour)}. ${formatVolume(total, unit)} in total across the period.`;
}

function hourLabel(hour: number): string {
  const suffix = hour < 12 ? "AM" : "PM";
  return `${hour % 12 === 0 ? 12 : hour % 12} ${suffix}`;
}
