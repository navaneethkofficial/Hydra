import Link from "next/link";
import {
  Bell,
  BriefcaseBusiness,
  Code2,
  Flame,
  GraduationCap,
  MoonStar,
  Plane,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Section, SectionHeading } from "./section";

/**
 * The landing-page story, in the order a visitor needs it: the problem they
 * recognise, the shape of the fix, then the three things that make the habit
 * stick — reminders, progress, consistency.
 */

// --- 1. The problem ---------------------------------------------------------

const SITUATIONS = [
  { icon: BriefcaseBusiness, title: "Deep in work", body: "Three meetings back to back and the glass never gets refilled." },
  { icon: GraduationCap, title: "Studying for hours", body: "You look up and the afternoon is gone." },
  { icon: Code2, title: "Coding late", body: "One more commit turns into three, and coffee isn't water." },
  { icon: Plane, title: "Travelling", body: "A new city, a new routine, and none of the usual cues." },
  { icon: Sparkles, title: "Simply distracted", body: "You meant to. You just didn't." },
  { icon: MoonStar, title: "Realising at night", body: "It's 11 PM and today was, what, one glass?" },
];

export function ProblemSection() {
  return (
    <Section id="problem" className="bg-secondary/40">
      <SectionHeading
        eyebrow="The problem"
        title="It's easy to forget something as simple as drinking water."
        description="Almost nobody needs convincing that they should drink more. The hard part is remembering to, in the middle of an ordinary busy day."
      />

      <ul className="mx-auto mt-14 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SITUATIONS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <Icon className="size-5 text-primary" aria-hidden />
            <h3 className="mt-3.5 text-sm font-semibold">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">{body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// --- 2. The solution --------------------------------------------------------

const STEPS = [
  {
    step: "01",
    title: "Set your goal",
    body: "Tell Hydra your basic information and your usual routine. It suggests a daily target you can change any time.",
  },
  {
    step: "02",
    title: "Get reminded",
    body: "Timely nudges throughout your day — not a rigid alarm every two hours, and never while you're asleep.",
  },
  {
    step: "03",
    title: "Drink & tap",
    body: "One tap logs the glass and updates your progress. Under two seconds, then back to what you were doing.",
  },
];

export function SolutionSection() {
  return (
    <Section id="how-it-works">
      <SectionHeading
        eyebrow="The solution"
        title="Your hydration, on autopilot."
        description="Three steps, and only the third one happens more than once."
      />

      <ol className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-3">
        {STEPS.map(({ step, title, body }) => (
          <li key={step} className="relative rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <span className="tabular text-xs font-semibold tracking-[0.14em] text-primary">{step}</span>
            <h3 className="mt-3 text-lg font-semibold tracking-tight">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">{body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

// --- 3. Smart reminders -----------------------------------------------------

const SIGNALS = [
  "Your schedule and waking hours",
  "How much you've already had today",
  "How long it's been since your last drink",
  "The pace you'd need to keep to finish the day",
  "When you usually drink, learned from your own history",
];

export function RemindersSection() {
  return (
    <Section id="reminders" className="bg-secondary/40">
      <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Smart reminders"
            title="Reminders that fit your day."
            description="Not an alarm on a timer. Hydra works out where you are against your own pace, and only speaks up when a nudge would actually help."
          />

          <ul className="mt-8 space-y-3">
            {SIGNALS.map((signal) => (
              <li key={signal} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="text-pretty">{signal}</span>
              </li>
            ))}
          </ul>

          <p className="mt-8 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground text-pretty">
            Just had a glass? Then it stays quiet. Asleep? It stays quiet then too.
          </p>
        </div>

        <div className="space-y-4">
          <ReminderCardPreview
            tone="primary"
            icon="💧"
            title="Time for a sip"
            body="You haven't logged water in a while."
            cta="Drink 250 ml"
          />
          <ReminderCardPreview
            tone="warning"
            icon="⚠️"
            title="You're falling a little behind"
            body="A small top-up now puts you right back on pace."
            cta="Take a sip"
          />
          <ReminderCardPreview
            tone="success"
            icon="✅"
            title="You're on track"
            body="Nice pace. No notification needed."
          />
        </div>
      </div>
    </Section>
  );
}

function ReminderCardPreview({
  tone,
  icon,
  title,
  body,
  cta,
}: {
  tone: "primary" | "warning" | "success";
  icon: string;
  title: string;
  body: string;
  cta?: string;
}) {
  const toneClasses = {
    primary: "bg-primary-soft text-primary",
    warning: "bg-warning-soft text-warning-foreground",
    success: "bg-success-soft text-success",
  }[tone];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3.5">
        <span aria-hidden className={`grid size-9 shrink-0 place-items-center rounded-xl text-base ${toneClasses}`}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">{body}</p>
          {cta && (
            <div className={`mt-3.5 inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold ${toneClasses}`}>
              {cta}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- 4. Progress ------------------------------------------------------------

export function ProgressSection() {
  return (
    <Section id="progress">
      <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div className="order-2 lg:order-1">
          <div className="mx-auto w-full max-w-md rounded-[2rem] border border-border bg-card p-7 shadow-[var(--shadow-lifted)]">
            <p className="text-sm font-medium text-muted-foreground">Today&rsquo;s hydration</p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="tabular text-4xl font-semibold tracking-tight">1.5 L</span>
              <span className="tabular text-lg text-muted-foreground">/ 2.5 L</span>
            </div>

            <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-[60%] rounded-full bg-primary" />
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="tabular font-semibold text-primary">60%</span>
              <span className="tabular text-muted-foreground">1 L remaining</span>
            </div>

            <div className="mt-7 space-y-3 border-t border-border pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Today
              </p>
              {[
                ["08:15", "250 ml"],
                ["09:40", "300 ml"],
                ["11:20", "250 ml"],
                ["13:05", "500 ml"],
              ].map(([time, amount]) => (
                <div key={time} className="flex items-center gap-3 text-sm">
                  <span className="tabular w-11 text-xs text-muted-foreground">{time}</span>
                  <span aria-hidden className="size-1.5 rounded-full bg-primary/40" />
                  <span className="tabular font-medium">{amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <SectionHeading
            align="left"
            eyebrow="Progress"
            title="Know exactly where you stand, in one glance."
            description="How much you've had, how much is left, and when you drank it. No dashboards to configure, no charts to interpret."
          />
        </div>
      </div>
    </Section>
  );
}

// --- 5. Consistency ---------------------------------------------------------

export function ConsistencySection() {
  const week = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <Section id="consistency" className="bg-secondary/40">
      <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Consistency"
            title="Don't chase perfect days. Build consistent ones."
            description="Hydra rewards showing up. Miss a day and you get a fresh start, not a lecture."
          />
          <p className="mt-7 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground text-pretty">
            &ldquo;Yesterday didn&rsquo;t go as planned. Today is a fresh start. 💧&rdquo;
          </p>
        </div>

        <div className="rounded-[2rem] border border-border bg-card p-7 shadow-[var(--shadow-lifted)]">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-warning-soft">
              <Flame className="size-6 text-warning" aria-hidden />
            </span>
            <div>
              <p className="tabular text-2xl font-semibold leading-none">7</p>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Day streak
              </p>
            </div>
          </div>

          <ul className="mt-7 grid grid-cols-7 gap-2">
            {week.map((day) => (
              <li key={day} className="text-center">
                <span className="block text-[11px] font-medium text-muted-foreground">{day}</span>
                <span className="mx-auto mt-2 grid size-9 place-items-center rounded-xl bg-success-soft text-success">
                  <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
                    <path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="sr-only">Goal reached</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

// --- 6. Insights ------------------------------------------------------------

const EXAMPLE_INSIGHTS = [
  { icon: "🧠", text: "You drink most of your water between 9 AM and 1 PM." },
  { icon: "💡", text: "Fridays are usually your lowest hydration days." },
  { icon: "📈", text: "Your weekly consistency improved by 18%." },
  { icon: "📉", text: "Your hydration usually drops off after 6 PM." },
];

export function InsightsSection() {
  return (
    <Section id="insights">
      <SectionHeading
        eyebrow="Insights"
        title="Useful observations, not a health report."
        description="After a few days, Hydra starts noticing your patterns — and uses them to time reminders better."
      />

      <ul className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-2">
        {EXAMPLE_INSIGHTS.map(({ icon, text }) => (
          <li
            key={text}
            className="flex items-start gap-3.5 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
          >
            <span aria-hidden className="text-xl leading-none">
              {icon}
            </span>
            <p className="text-sm leading-relaxed text-pretty">{text}</p>
          </li>
        ))}
      </ul>

      <div className="mx-auto mt-10 max-w-4xl rounded-2xl border border-border bg-secondary/50 p-5">
        <p className="text-center text-sm text-muted-foreground text-pretty">
          Hydra describes your habits. It doesn&rsquo;t diagnose anything — your daily target is a
          general guide, not medical advice.
        </p>
      </div>
    </Section>
  );
}

// --- 7. Final CTA -----------------------------------------------------------

export function CtaSection({ signedIn }: { signedIn: boolean }) {
  return (
    <Section className="pb-24">
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2.5rem] border border-border bg-card px-6 py-16 text-center shadow-[var(--shadow-lifted)] sm:px-16">
        <div aria-hidden className="absolute -top-24 left-1/2 -z-10 size-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

        <span aria-hidden className="text-3xl">💧</span>
        <h2 className="mt-5 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Make drinking water a habit.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-pretty text-muted-foreground">
          Set a goal in under a minute. Then let Hydra do the remembering.
        </p>

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={signedIn ? "/today" : "/register"}>
              {signedIn ? "Open my dashboard" : "Start for free"}
              <Bell aria-hidden />
            </Link>
          </Button>
          {!signedIn && (
            <Button asChild size="lg" variant="outline">
              <Link href="/login">I already have an account</Link>
            </Button>
          )}
        </div>
      </div>
    </Section>
  );
}
