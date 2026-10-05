"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HydrationRing } from "@/components/hydration/hydration-ring";
import { api, ApiClientError } from "@/lib/api-client";
import { detectTimezone } from "@/hooks/use-form-submit";
import {
  clampDailyGoal,
  MAX_DAILY_GOAL_ML,
  MIN_DAILY_GOAL_ML,
  suggestDailyGoal,
  type ActivityLevel,
} from "@/lib/domain/goal";
import { formatVolume, type Unit } from "@/lib/domain/units";
import { cn } from "@/lib/utils";

/**
 * Onboarding: three short steps, not a questionnaire.
 *
 * The suggested goal is computed on the device from the same pure function the
 * server uses, so the number moves as the user answers — the connection between
 * their answers and their target is visible rather than asserted.
 */

const ACTIVITY_OPTIONS: Array<{ value: ActivityLevel; label: string; hint: string }> = [
  { value: "LOW", label: "Mostly seated", hint: "Desk work, little exercise" },
  { value: "MODERATE", label: "Moderately active", hint: "A walk or a workout most days" },
  { value: "ACTIVE", label: "Active", hint: "Training or on your feet daily" },
  { value: "VERY_ACTIVE", label: "Very active", hint: "Hard training, physical job" },
];

interface Answers {
  weight: string;
  activityLevel: ActivityLevel;
  wakeTime: string;
  sleepTime: string;
  unit: Unit;
  goal: number | null;
}

const TOTAL_STEPS = 3;

export function OnboardingFlow({ name }: { name: string }) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [answers, setAnswers] = React.useState<Answers>({
    weight: "",
    activityLevel: "MODERATE",
    wakeTime: "07:00",
    sleepTime: "23:00",
    unit: "ML",
    goal: null,
  });

  const weightKg = parseWeight(answers.weight);
  const suggested = suggestDailyGoal({ weightKg, activityLevel: answers.activityLevel });
  const goal = answers.goal ?? suggested;

  const update = <K extends keyof Answers>(key: K, value: Answers[K]) =>
    setAnswers((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setIsPending(true);
    setError(null);
    try {
      await api.post("/api/onboarding", {
        weightKg,
        activityLevel: answers.activityLevel,
        wakeTime: answers.wakeTime,
        sleepTime: answers.sleepTime,
        unit: answers.unit,
        dailyGoal: goal,
        timezone: detectTimezone(),
      });
      router.replace("/today");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : "We couldn't save that. Please try again.",
      );
      setIsPending(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <ol className="mb-8 flex gap-2" aria-label={`Step ${step + 1} of ${TOTAL_STEPS}`}>
        {Array.from({ length: TOTAL_STEPS }, (_, index) => (
          <li
            key={index}
            aria-current={index === step ? "step" : undefined}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              index <= step ? "bg-primary" : "bg-secondary",
            )}
          >
            <span className="sr-only">
              Step {index + 1}
              {index === step ? " (current)" : ""}
            </span>
          </li>
        ))}
      </ol>

      {error && (
        <Alert tone="error" className="mb-5">
          {error}
        </Alert>
      )}

      {step === 0 && (
        <section className="animate-[var(--animate-rise)] space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              Let&rsquo;s set your hydration goal, {name}.
            </h1>
            <p className="text-sm text-muted-foreground text-pretty">
              Two answers is all it takes. You can change everything later.
            </p>
          </header>

          <Field
            label="Weight"
            htmlFor="weight"
            hint="Optional — it just sharpens the suggestion."
          >
            <div className="flex gap-2">
              <Input
                name="weight"
                type="number"
                inputMode="decimal"
                min={20}
                max={400}
                placeholder="70"
                value={answers.weight}
                onChange={(event) => update("weight", event.target.value)}
                autoFocus
              />
              <span className="grid h-11 w-14 shrink-0 place-items-center rounded-xl bg-secondary text-sm font-medium text-muted-foreground">
                kg
              </span>
            </div>
          </Field>

          <fieldset className="space-y-2.5">
            <legend className="mb-2.5 text-sm font-medium">How active is a typical day?</legend>
            {ACTIVITY_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
                  answers.activityLevel === option.value
                    ? "border-primary bg-primary-soft"
                    : "border-border hover:bg-secondary",
                )}
              >
                <input
                  type="radio"
                  name="activity"
                  value={option.value}
                  checked={answers.activityLevel === option.value}
                  onChange={() => update("activityLevel", option.value)}
                  className="mt-0.5 size-4 accent-[var(--color-primary)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="block text-xs text-muted-foreground">{option.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </section>
      )}

      {step === 1 && (
        <section className="animate-[var(--animate-rise)] space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              When does your day run?
            </h1>
            <p className="text-sm text-muted-foreground text-pretty">
              Reminders live inside these hours, and never outside them.
            </p>
          </header>

          <div className="grid grid-cols-2 gap-3">
            <Field label="I wake around" htmlFor="wakeTime">
              <Input
                type="time"
                value={answers.wakeTime}
                onChange={(event) => update("wakeTime", event.target.value)}
              />
            </Field>
            <Field label="I sleep around" htmlFor="sleepTime">
              <Input
                type="time"
                value={answers.sleepTime}
                onChange={(event) => update("sleepTime", event.target.value)}
              />
            </Field>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit">Preferred unit</Label>
            <Select value={answers.unit} onValueChange={(value) => update("unit", value as Unit)}>
              <SelectTrigger id="unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ML">Millilitres and litres</SelectItem>
                <SelectItem value="OZ">Fluid ounces</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="animate-[var(--animate-rise)] space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              Here&rsquo;s your daily target.
            </h1>
            <p className="text-sm text-muted-foreground text-pretty">
              A general guide to aim at, not medical advice. Drag to change it.
            </p>
          </header>

          <div className="flex justify-center py-2">
            <HydrationRing consumed={0} goal={goal} unit={answers.unit} size={200} />
          </div>

          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="goal">Daily goal</Label>
              <span className="tabular text-sm font-semibold text-primary">
                {formatVolume(goal, answers.unit)}
              </span>
            </div>
            <Slider
              id="goal"
              min={MIN_DAILY_GOAL_ML}
              max={MAX_DAILY_GOAL_ML}
              step={100}
              value={[goal]}
              onValueChange={([value]) => update("goal", clampDailyGoal(value ?? goal))}
              aria-label="Daily hydration goal"
            />
            {answers.goal !== null && answers.goal !== suggested && (
              <button
                type="button"
                onClick={() => update("goal", null)}
                className="text-xs text-primary hover:underline"
              >
                Reset to our suggestion ({formatVolume(suggested, answers.unit)})
              </button>
            )}
          </div>
        </section>
      )}

      <div className="mt-9 flex gap-3">
        {step > 0 && (
          <Button type="button" variant="outline" size="lg" onClick={() => setStep(step - 1)}>
            <ArrowLeft aria-hidden />
            <span className="sr-only sm:not-sr-only">Back</span>
          </Button>
        )}
        {step < TOTAL_STEPS - 1 ? (
          <Button type="button" size="lg" block onClick={() => setStep(step + 1)}>
            Continue
            <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button type="button" size="lg" block onClick={submit} disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" aria-hidden />}
            {isPending ? "Setting things up…" : "Start tracking"}
          </Button>
        )}
      </div>
    </div>
  );
}

function parseWeight(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 20 && parsed <= 400 ? parsed : null;
}
