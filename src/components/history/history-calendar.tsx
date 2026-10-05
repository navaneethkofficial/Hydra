"use client";

import * as React from "react";

import { addDays, isoWeekdayIndex, type DayKey } from "@/lib/domain/time";
import { cn } from "@/lib/utils";
import type { DaySummaryDto } from "@/types/api";

/**
 * A month at a glance.
 *
 * Each day is a cell that fills from the bottom in proportion to that day's
 * progress, with a ring for a completed goal. Progress reads from the fill
 * height and the tick, never from colour alone.
 */

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface HistoryCalendarProps {
  /** First day of the month being shown, `YYYY-MM-01`. */
  monthStart: DayKey;
  days: readonly DaySummaryDto[];
  today: DayKey;
  selected: DayKey | null;
  onSelect: (date: DayKey) => void;
}

export function HistoryCalendar({
  monthStart,
  days,
  today,
  selected,
  onSelect,
}: HistoryCalendarProps) {
  const byDate = React.useMemo(
    () => new Map(days.map((day) => [day.date, day] as const)),
    [days],
  );

  const cells = React.useMemo(() => buildMonthGrid(monthStart), [monthStart]);
  const monthPrefix = monthStart.slice(0, 7);

  return (
    // Capped so cells stay a comfortable tap size on a phone without becoming
    // oversized panels on a wide screen.
    <div className="mx-auto w-full max-w-md">
      <div className="grid grid-cols-7 gap-1.5 pb-2" aria-hidden>
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="text-center text-[11px] font-medium text-muted-foreground">
            {label}
          </span>
        ))}
      </div>

      <div role="grid" aria-label="Hydration history" className="grid grid-cols-7 gap-1.5">
        {cells.map((date) => {
          if (!date.startsWith(monthPrefix)) {
            return <span key={date} role="gridcell" aria-hidden className="aspect-square" />;
          }

          const summary = byDate.get(date);
          const percentage = summary?.percentage ?? 0;
          const isToday = date === today;
          const isFuture = date > today;
          const dayNumber = Number(date.slice(8));

          return (
            <button
              key={date}
              role="gridcell"
              type="button"
              disabled={isFuture}
              aria-current={isToday ? "date" : undefined}
              aria-selected={selected === date}
              aria-label={ariaLabel(date, summary, isFuture)}
              onClick={() => onSelect(date)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-xl border text-xs font-medium transition-all",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                isFuture
                  ? "cursor-default border-dashed border-border/60 text-muted-foreground/40"
                  : "border-border hover:border-primary/40",
                selected === date && "border-primary ring-2 ring-[var(--primary-ring)]",
                isToday && selected !== date && "border-primary/60",
              )}
            >
              {/* The day's fill, rising from the bottom of the cell. */}
              {!isFuture && percentage > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-0 bottom-0",
                    summary?.goalCompleted ? "bg-success/20" : "bg-primary/20",
                  )}
                  style={{ height: `${percentage}%` }}
                />
              )}

              <span className="tabular relative">{dayNumber}</span>

              {summary?.goalCompleted && (
                <span
                  aria-hidden
                  className="absolute right-1 top-1 size-1.5 rounded-full bg-success"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Monday-first cells for the month, padded to whole weeks.
 *
 * Only the weeks the month actually occupies are produced — a fixed six-week
 * grid leaves a blank row under most months.
 */
function buildMonthGrid(monthStart: DayKey): DayKey[] {
  const leading = isoWeekdayIndex(monthStart);
  const gridStart = addDays(monthStart, -leading);

  const [year, month] = monthStart.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year ?? 1970, month ?? 1, 0)).getUTCDate();
  const weeks = Math.ceil((leading + daysInMonth) / 7);

  return Array.from({ length: weeks * 7 }, (_, index) => addDays(gridStart, index));
}

function ariaLabel(date: DayKey, summary: DaySummaryDto | undefined, isFuture: boolean): string {
  const readable = new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  if (isFuture) return `${readable}, upcoming`;
  if (!summary || summary.totalAmount === 0) return `${readable}, nothing logged`;
  return `${readable}, ${summary.percentage}% of goal${summary.goalCompleted ? ", goal reached" : ""}`;
}
