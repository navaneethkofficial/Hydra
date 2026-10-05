"use client";

import * as React from "react";

import { computeProgress } from "@/lib/domain/progress";
import { splitVolume, type Unit } from "@/lib/domain/units";
import { cn } from "@/lib/utils";

/**
 * The dashboard's centrepiece: a progress ring wrapped around a container that
 * fills as the day goes on.
 *
 * Two channels carry the same information — the arc's sweep and the water
 * level — plus the number in the middle, so the state reads at a glance and
 * never depends on colour alone.
 */

export interface HydrationRingProps {
  consumed: number;
  goal: number;
  unit?: Unit;
  /** Pixel diameter. */
  size?: number;
  /** Suppresses the fill animation for the static landing-page mockup. */
  animate?: boolean;
  className?: string;
}

const STROKE = 14;

export function HydrationRing({
  consumed,
  goal,
  unit = "ML",
  size = 264,
  animate = true,
  className,
}: HydrationRingProps) {
  const progress = computeProgress(consumed, goal);
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress.percentage / 100);

  const consumedParts = splitVolume(progress.consumed, unit);
  const goalParts = splitVolume(progress.goal, unit);
  const gradientId = React.useId();
  const clipId = React.useId();

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${progress.percentage}% of your daily goal — ${consumedParts.value} ${consumedParts.suffix} of ${goalParts.value} ${goalParts.suffix}.`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-2)" />
            <stop offset="100%" stopColor="var(--color-primary)" />
          </linearGradient>
          <clipPath id={clipId}>
            <circle cx={size / 2} cy={size / 2} r={radius - STROKE / 2 - 4} />
          </clipPath>
        </defs>

        {/* The water body, clipped to the inner disc. */}
        <g clipPath={`url(#${clipId})`} className="rotate-90" style={{ transformOrigin: "center" }}>
          <rect
            x="0"
            width={size}
            height={size}
            fill="var(--color-primary)"
            fillOpacity="0.10"
            y={size - (size * progress.percentage) / 100}
            style={{ transition: animate ? "y 700ms cubic-bezier(0.22, 1, 0.36, 1)" : undefined }}
          />
        </g>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-track)"
          strokeWidth={STROKE}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: animate ? "stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)" : undefined,
          }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center">
        <span aria-hidden className="text-lg leading-none">
          💧
        </span>
        <div className="flex items-baseline gap-1 tabular">
          <span className="text-[2.75rem] font-semibold leading-none tracking-tight">
            {consumedParts.value}
          </span>
          <span className="text-lg font-medium text-muted-foreground">{consumedParts.suffix}</span>
        </div>
        <p className="tabular text-sm text-muted-foreground">
          of {goalParts.value} {goalParts.suffix}
        </p>
        <p
          className={cn(
            "tabular mt-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            progress.completed ? "bg-success-soft text-success" : "bg-primary-soft text-primary",
          )}
        >
          {progress.percentage}%
        </p>
      </div>
    </div>
  );
}
