"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHydration } from "@/hooks/use-hydration";
import { formatServing } from "@/lib/domain/units";
import type { WaterLogDto } from "@/types/api";

/**
 * When you drank, today.
 *
 * The point is self-knowledge, not bookkeeping: seeing a four-hour gap at 3 PM
 * teaches more than any chart. Removing a mis-tap is one button, no dialog.
 */
export function TodayTimeline() {
  const { today, removeLog } = useHydration();
  const { logs, profile, timezone } = today;

  const formatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: timezone,
      }),
    [timezone],
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Today</CardTitle>
        {logs.length > 0 && (
          <span className="tabular text-xs text-muted-foreground">
            {logs.length} {logs.length === 1 ? "drink" : "drinks"}
          </span>
        )}
      </CardHeader>

      <CardContent>
        {logs.length === 0 ? (
          <EmptyTimeline />
        ) : (
          <ol className="space-y-0.5">
            {[...logs].reverse().map((log, index, all) => (
              <TimelineRow
                key={log.id}
                log={log}
                time={formatter.format(new Date(log.loggedAt))}
                amount={formatServing(log.amount, profile.unit)}
                isLast={index === all.length - 1}
                onRemove={() => void removeLog(log.id)}
              />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineRow({
  log,
  time,
  amount,
  isLast,
  onRemove,
}: {
  log: WaterLogDto;
  time: string;
  amount: string;
  isLast: boolean;
  onRemove: () => void;
}) {
  // An optimistic row has no server id yet, so deleting it would 404.
  const isPending = log.id.startsWith("optimistic-");

  return (
    <li className="group relative flex items-center gap-3.5 py-2">
      <span className="tabular w-11 shrink-0 text-xs text-muted-foreground">{time}</span>

      <span aria-hidden className="relative flex size-4 shrink-0 items-center justify-center">
        <span className="size-2 rounded-full bg-primary" />
        {!isLast && <span className="absolute top-4 h-[calc(100%+0.5rem)] w-px bg-border" />}
      </span>

      <span className="tabular flex-1 text-sm font-medium">{amount}</span>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        disabled={isPending}
        aria-label={`Remove the ${amount} drink logged at ${time}`}
        className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
      >
        <Trash2 className="text-muted-foreground" />
      </Button>
    </li>
  );
}

function EmptyTimeline() {
  return (
    <div className="py-8 text-center">
      <span aria-hidden className="text-2xl">
        💧
      </span>
      <p className="mt-3 text-sm font-medium">Your hydration journey starts here.</p>
      <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground text-pretty">
        Tap a serving above to log your first drink of the day.
      </p>
    </div>
  );
}
