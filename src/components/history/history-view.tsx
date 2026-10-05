"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { HistoryCalendar } from "./history-calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { addDays, type DayKey } from "@/lib/domain/time";
import { formatServing, formatVolume } from "@/lib/domain/units";
import type { DayDetailDto, HistoryDto } from "@/types/api";

/**
 * The history screen: a month calendar, its totals, and the detail of whichever
 * day you tap.
 *
 * Months are fetched on demand and cached in memory, so paging back and forth
 * through a year costs one request per month, once.
 */
export function HistoryView({ initial }: { initial: HistoryDto }) {
  const today = initial.to;
  const [monthStart, setMonthStart] = React.useState<DayKey>(`${today.slice(0, 7)}-01`);
  const [months, setMonths] = React.useState<Record<string, HistoryDto>>({
    [`${today.slice(0, 7)}-01`]: initial,
  });
  const [selected, setSelected] = React.useState<DayKey | null>(today);
  const [details, setDetails] = React.useState<Record<string, DayDetailDto>>({});

  const month = months[monthStart];
  // Loading is a fact about the cache, not extra state to keep in sync with it.
  const isLoadingMonth = month === undefined;
  const detail = selected ? (details[selected] ?? null) : null;

  React.useEffect(() => {
    if (months[monthStart]) return;

    let cancelled = false;
    api
      .get<HistoryDto>("/api/hydration/history", {
        query: { from: monthStart, to: lastDayOfMonth(monthStart) },
      })
      .then((result) => {
        if (!cancelled) setMonths((current) => ({ ...current, [monthStart]: result }));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [monthStart, months]);

  React.useEffect(() => {
    if (!selected || details[selected]) return;

    let cancelled = false;
    api
      .get<DayDetailDto>(`/api/hydration/history/${selected}`)
      .then((result) => {
        if (!cancelled) setDetails((current) => ({ ...current, [selected]: result }));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [selected, details]);

  const canGoForward = monthStart < `${today.slice(0, 7)}-01`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">History</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Every day you showed up, and the ones you didn&rsquo;t. Both are useful.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {formatMonth(monthStart)}
              {isLoadingMonth && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
            </CardTitle>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Previous month"
                onClick={() => setMonthStart(shiftMonth(monthStart, -1))}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Next month"
                disabled={!canGoForward}
                onClick={() => setMonthStart(shiftMonth(monthStart, 1))}
              >
                <ChevronRight />
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {month ? (
              <HistoryCalendar
                monthStart={monthStart}
                days={month.days}
                today={today}
                selected={selected}
                onSelect={setSelected}
              />
            ) : (
              <Skeleton className="h-72 w-full rounded-xl" />
            )}

            {month && (
              <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-5 text-center">
                <Stat label="Average" value={formatVolume(month.totals.averageDaily, month.unit)} />
                <Stat label="Goals reached" value={`${month.totals.goalsReached}`} />
                <Stat label="Days logged" value={`${month.totals.daysLogged}`} />
              </dl>
            )}
          </CardContent>
        </Card>

        <DayDetailPanel detail={detail} selected={selected} unit={initial.unit} timezone={initial.timezone} />
      </div>
    </div>
  );
}

function DayDetailPanel({
  detail,
  selected,
  unit,
  timezone,
}: {
  detail: DayDetailDto | null;
  selected: DayKey | null;
  unit: HistoryDto["unit"];
  timezone: string;
}) {
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

  if (!selected) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Pick a day to see what it looked like.
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{formatFullDate(selected)}</CardTitle>
      </CardHeader>

      <CardContent>
        {!detail ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ) : detail.summary && detail.summary.totalAmount > 0 ? (
          <>
            <div className="rounded-xl bg-secondary/60 p-4">
              <div className="flex items-baseline justify-between">
                <span className="tabular text-2xl font-semibold">
                  {formatVolume(detail.summary.totalAmount, unit)}
                </span>
                <span className="tabular text-sm text-muted-foreground">
                  of {formatVolume(detail.summary.goal, unit)}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-card">
                <div
                  className={detail.summary.goalCompleted ? "h-full bg-success" : "h-full bg-primary"}
                  style={{ width: `${detail.summary.percentage}%` }}
                />
              </div>
              <p className="tabular mt-2 text-xs text-muted-foreground">
                {detail.summary.percentage}%
                {detail.summary.goalCompleted ? " — goal reached" : ""}
              </p>
            </div>

            <ol className="mt-5 space-y-2">
              {detail.logs.map((log) => (
                <li key={log.id} className="flex items-center gap-3 text-sm">
                  <span className="tabular w-11 text-xs text-muted-foreground">
                    {formatter.format(new Date(log.loggedAt))}
                  </span>
                  <span aria-hidden className="size-1.5 rounded-full bg-primary/40" />
                  <span className="tabular font-medium">{formatServing(log.amount, unit)}</span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground text-pretty">
            Nothing logged this day. That happens — the streak starts again whenever you&rsquo;re ready.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
      <dd className="tabular mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}

// --- date helpers -----------------------------------------------------------

function shiftMonth(monthStart: DayKey, delta: number): DayKey {
  const [year, month] = monthStart.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function lastDayOfMonth(monthStart: DayKey): DayKey {
  return addDays(shiftMonth(monthStart, 1), -1);
}

function formatMonth(monthStart: DayKey): string {
  return new Date(`${monthStart}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatFullDate(date: DayKey): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
