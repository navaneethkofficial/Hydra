"use client";

import { cn } from "@/lib/utils";
import { formatVolume, type Unit } from "@/lib/domain/units";
import type { InsightsDto } from "@/types/api";

/**
 * This week, day by day.
 *
 * One series, so one hue and no legend — the heading names it. Bars are
 * horizontal because the labels are words, and each carries its own value, so
 * the chart doubles as a readable table.
 */
export function WeeklyChart({ week, unit }: { week: InsightsDto["week"]; unit: Unit }) {
  return (
    <ul className="space-y-2.5">
      {week.map((day) => (
        <li key={day.date} className="flex items-center gap-3">
          <span
            className={cn(
              "w-9 shrink-0 text-xs font-medium",
              day.isToday ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {day.label}
          </span>

          <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
            {!day.isFuture && day.percentage > 0 && (
              <span
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  day.percentage >= 100 ? "bg-success" : "bg-primary",
                )}
                style={{ width: `${Math.max(day.percentage, 3)}%` }}
              />
            )}
          </span>

          <span
            className={cn(
              "tabular w-11 shrink-0 text-right text-xs",
              day.isFuture ? "text-muted-foreground/50" : "font-medium",
            )}
            title={day.isFuture ? undefined : formatVolume(day.totalAmount, unit)}
          >
            {day.isFuture ? "—" : `${day.percentage}%`}
          </span>
        </li>
      ))}
    </ul>
  );
}
