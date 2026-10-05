import { Flame, Sparkles, Target, TrendingUp } from "lucide-react";

import { HourlyChart } from "./hourly-chart";
import { WeeklyChart } from "./weekly-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVolume } from "@/lib/domain/units";
import type { InsightsDto } from "@/types/api";

/**
 * The insights screen.
 *
 * Rendered on the server — nothing here is interactive, so none of it needs to
 * cost the client a kilobyte of JavaScript.
 */
export function InsightsView({ data }: { data: InsightsDto }) {
  const { unit, streak } = data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Insights</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          What Hydra has noticed over the last {data.rangeDays} days.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          icon={<TrendingUp className="size-4" />}
          label="Average daily"
          value={data.averageDaily > 0 ? formatVolume(data.averageDaily, unit) : "—"}
        />
        <StatTile
          icon={<Flame className="size-4" />}
          label="Current streak"
          value={`${streak.current} ${streak.current === 1 ? "day" : "days"}`}
        />
        <StatTile
          icon={<Sparkles className="size-4" />}
          label="Best streak"
          value={`${streak.longest} ${streak.longest === 1 ? "day" : "days"}`}
        />
        <StatTile
          icon={<Target className="size-4" />}
          label="Goals reached"
          value={`${data.daysGoalReached}`}
        />
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>This week</CardTitle>
            <CardDescription>Share of your daily goal, Monday to Sunday.</CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklyChart week={data.week} unit={unit} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your daily rhythm</CardTitle>
            <CardDescription>When you tend to drink, across the last {data.rangeDays} days.</CardDescription>
          </CardHeader>
          <CardContent>
            <HourlyChart hourly={data.hourly} unit={unit} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What we&rsquo;ve noticed</CardTitle>
          <CardDescription>
            Observations about your habits — not health advice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data.hasEnoughData || data.insights.length === 0 ? (
            <div className="py-8 text-center">
              <span aria-hidden className="text-2xl">
                🧠
              </span>
              <p className="mt-3 text-sm font-medium">Not enough to go on yet.</p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground text-pretty">
                Keep logging for a few days and we&rsquo;ll start finding your patterns.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.insights.map((insight) => (
                <li
                  key={insight.id}
                  className="flex items-start gap-3 rounded-xl bg-secondary/50 p-4"
                >
                  <span aria-hidden className="text-lg leading-none">
                    {insight.icon}
                  </span>
                  <p className="text-sm leading-relaxed text-pretty">{insight.title}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {data.bestDay && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
            <div>
              <p className="text-sm font-medium">Your best day so far</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formatFullDate(data.bestDay.date)}
              </p>
            </div>
            <span className="tabular text-2xl font-semibold text-primary">
              {formatVolume(data.bestDay.totalAmount, unit)}
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        <span aria-hidden className="text-primary">
          {icon}
        </span>
        {label}
      </dt>
      <dd className="tabular mt-2 text-lg font-semibold">{value}</dd>
    </div>
  );
}

function formatFullDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
