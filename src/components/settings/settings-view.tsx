"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { AppearanceSection } from "./appearance-section";
import { SettingsRow, SettingsSection } from "./settings-section";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { SubmitButton } from "@/components/ui/submit-button";
import { Switch } from "@/components/ui/switch";
import { AlertSoundField } from "./alert-sound-field";
import { NotificationSettingsHint } from "./notification-hint";
import { VibrationRow } from "./vibration-row";
import { api } from "@/lib/api-client";
import {
  clampDailyGoal,
  MAX_DAILY_GOAL_ML,
  MIN_DAILY_GOAL_ML,
  type ActivityLevel,
} from "@/lib/domain/goal";
import { MAX_REMINDER_INTERVAL, MIN_REMINDER_INTERVAL } from "@/lib/domain/reminder-engine";
import { formatVolume, mlToOz, ozToMl, type Unit } from "@/lib/domain/units";
import { useFormSubmit } from "@/hooks/use-form-submit";
import { readFormFields, validateForm } from "@/lib/form-validation";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { changePasswordSchema } from "@/server/validation/schemas";
import type { SettingsDto } from "@/types/api";

/**
 * Profile and settings.
 *
 * Grouped exactly as the user thinks about them — who I am, what I'm aiming
 * for, when to nudge me, how it looks, and my account — with each group saving
 * independently.
 */
export function SettingsView({ initial }: { initial: SettingsDto }) {
  const [settings, setSettings] = React.useState(initial);
  const router = useRouter();

  /** Sends a patch and adopts the server's answer as the new truth. */
  const save = React.useCallback(async (patch: Record<string, unknown>) => {
    const result = await api.put<SettingsDto>("/api/settings", patch);
    setSettings(result);
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Profile</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Everything about how Hydra works for you.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <PersonalSection settings={settings} onSave={save} />
          <HydrationSection settings={settings} onSave={save} />
        </div>
        <div className="space-y-6">
          <RemindersSection settings={settings} onSave={save} />
          <AppearanceSection />
          <AccountSection settings={settings} />
        </div>
      </div>
    </div>
  );
}

// --- Personal ---------------------------------------------------------------

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  LOW: "Mostly seated",
  MODERATE: "Moderately active",
  ACTIVE: "Active",
  VERY_ACTIVE: "Very active",
};

function PersonalSection({
  settings,
  onSave,
}: {
  settings: SettingsDto;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = React.useState(settings.user.name);
  const [weight, setWeight] = React.useState(settings.profile.weightKg?.toString() ?? "");
  const [activity, setActivity] = React.useState(settings.profile.activityLevel);

  const dirty =
    name !== settings.user.name ||
    weight !== (settings.profile.weightKg?.toString() ?? "") ||
    activity !== settings.profile.activityLevel;

  return (
    <SettingsSection
      title="Personal information"
      description="Used to suggest a daily target — nothing else."
      dirty={dirty}
      onSave={() =>
        onSave({
          profile: {
            name: name.trim(),
            weightKg: weight.trim() === "" ? null : Number.parseFloat(weight),
            activityLevel: activity,
          },
        })
      }
    >
      <Field label="Name" htmlFor="name">
        <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
      </Field>

      <Field label="Weight (kg)" htmlFor="weight" hint="Leave blank to skip.">
        <Input
          type="number"
          inputMode="decimal"
          min={20}
          max={400}
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
        />
      </Field>

      <div className="space-y-2">
        <Label htmlFor="activity">Activity level</Label>
        <Select value={activity} onValueChange={(value) => setActivity(value as ActivityLevel)}>
          <SelectTrigger id="activity">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ACTIVITY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </SettingsSection>
  );
}

// --- Hydration --------------------------------------------------------------

function HydrationSection({
  settings,
  onSave,
}: {
  settings: SettingsDto;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [goal, setGoal] = React.useState(settings.profile.dailyGoal);
  const [serving, setServing] = React.useState(settings.profile.defaultServing);
  const [unit, setUnit] = React.useState<Unit>(settings.profile.unit);
  const [wakeTime, setWakeTime] = React.useState(settings.profile.wakeTime);
  const [sleepTime, setSleepTime] = React.useState(settings.profile.sleepTime);

  const dirty =
    goal !== settings.profile.dailyGoal ||
    serving !== settings.profile.defaultServing ||
    unit !== settings.profile.unit ||
    wakeTime !== settings.profile.wakeTime ||
    sleepTime !== settings.profile.sleepTime;

  return (
    <SettingsSection
      title="Hydration"
      description="Your target and the serving behind the big button."
      dirty={dirty}
      onSave={() =>
        onSave({
          profile: {
            dailyGoal: goal,
            defaultServing: serving,
            unit,
            wakeTime,
            sleepTime,
          },
        })
      }
    >
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="goal">Daily goal</Label>
          <span className="tabular text-sm font-semibold text-primary">
            {formatVolume(goal, unit)}
          </span>
        </div>
        <Slider
          id="goal"
          min={MIN_DAILY_GOAL_ML}
          max={MAX_DAILY_GOAL_ML}
          step={100}
          value={[goal]}
          onValueChange={([value]) => setGoal(clampDailyGoal(value ?? goal))}
          aria-label="Daily hydration goal"
        />
        {goal !== settings.suggestedGoal && (
          <button
            type="button"
            onClick={() => setGoal(settings.suggestedGoal)}
            className="text-xs text-primary hover:underline"
          >
            Use our suggestion ({formatVolume(settings.suggestedGoal, unit)})
          </button>
        )}
      </div>

      <Field
        label={`Default serving (${unit === "OZ" ? "oz" : "ml"})`}
        htmlFor="serving"
        hint="The amount on the primary log button."
      >
        <Input
          type="number"
          inputMode="numeric"
          min={unit === "OZ" ? 2 : 50}
          max={unit === "OZ" ? 68 : 2000}
          value={unit === "OZ" ? Math.round(mlToOz(serving)) : serving}
          onChange={(event) => {
            const raw = Number.parseFloat(event.target.value);
            if (!Number.isFinite(raw)) return;
            setServing(unit === "OZ" ? ozToMl(raw) : Math.round(raw));
          }}
        />
      </Field>

      <div className="space-y-2">
        <Label htmlFor="unit">Measurement unit</Label>
        <Select value={unit} onValueChange={(value) => setUnit(value as Unit)}>
          <SelectTrigger id="unit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ML">Millilitres and litres</SelectItem>
            <SelectItem value="OZ">Fluid ounces</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Wake time" htmlFor="wakeTime">
          <Input type="time" value={wakeTime} onChange={(event) => setWakeTime(event.target.value)} />
        </Field>
        <Field label="Sleep time" htmlFor="sleepTime">
          <Input type="time" value={sleepTime} onChange={(event) => setSleepTime(event.target.value)} />
        </Field>
      </div>
    </SettingsSection>
  );
}

// --- Reminders --------------------------------------------------------------

const INTERVALS = [30, 45, 60, 90, 120, 180];
const CUSTOM_INTERVAL = "custom";

function formatInterval(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function RemindersSection({
  settings,
  onSave,
}: {
  settings: SettingsDto;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [reminders, setReminders] = React.useState(settings.reminders);

  const patch = <K extends keyof typeof reminders>(key: K, value: (typeof reminders)[K]) =>
    setReminders((current) => ({ ...current, [key]: value }));

  // A saved interval that isn't one of the presets can only have come from the
  // custom field, so reopen it there rather than showing an empty select.
  const [custom, setCustom] = React.useState(!INTERVALS.includes(settings.reminders.interval));
  const [customDraft, setCustomDraft] = React.useState(String(settings.reminders.interval));

  const customValue = Number(customDraft);
  const customError =
    custom &&
    (!Number.isInteger(customValue) || customValue < MIN_REMINDER_INTERVAL || customValue > MAX_REMINDER_INTERVAL)
      ? `Pick a whole number from ${MIN_REMINDER_INTERVAL} to ${MAX_REMINDER_INTERVAL} minutes.`
      : undefined;

  const dirty = JSON.stringify(reminders) !== JSON.stringify(settings.reminders);

  return (
    <SettingsSection
      title="Reminders"
      description="When Hydra is allowed to speak up."
      dirty={dirty && !customError}
      onSave={() => onSave({ reminders })}
    >
      <NotificationSettingsHint />

      <SettingsRow label="Notifications" hint="Nudges when a top-up would help." htmlFor="reminders-enabled">
        <Switch
          id="reminders-enabled"
          checked={reminders.enabled}
          onCheckedChange={(value) => patch("enabled", value)}
        />
      </SettingsRow>

      <div className="space-y-2">
        <Label htmlFor="interval">Reminder interval</Label>
        <Select
          value={custom ? CUSTOM_INTERVAL : String(reminders.interval)}
          onValueChange={(value) => {
            if (value === CUSTOM_INTERVAL) {
              setCustom(true);
              setCustomDraft(String(reminders.interval));
              return;
            }
            setCustom(false);
            patch("interval", Number(value));
          }}
        >
          <SelectTrigger id="interval">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTERVALS.map((minutes) => (
              <SelectItem key={minutes} value={String(minutes)}>
                Every {formatInterval(minutes)}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_INTERVAL}>Custom…</SelectItem>
          </SelectContent>
        </Select>
        {custom && (
          <Field
            label="Custom interval (minutes)"
            htmlFor="customInterval"
            error={customError}
            hint={`Every ${formatInterval(customValue)}`}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={MIN_REMINDER_INTERVAL}
              max={MAX_REMINDER_INTERVAL}
              step={1}
              value={customDraft}
              onChange={(event) => {
                const draft = event.target.value;
                setCustomDraft(draft);
                const minutes = Number(draft);
                if (Number.isInteger(minutes) && minutes >= MIN_REMINDER_INTERVAL && minutes <= MAX_REMINDER_INTERVAL) {
                  patch("interval", minutes);
                }
              }}
            />
          </Field>
        )}
        <p className="text-xs text-muted-foreground text-pretty">
          A baseline. Hydra shortens it when you fall behind and relaxes it when you&rsquo;re ahead.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start" htmlFor="startTime">
          <Input
            type="time"
            value={reminders.startTime}
            onChange={(event) => patch("startTime", event.target.value)}
          />
        </Field>
        <Field label="End" htmlFor="endTime">
          <Input
            type="time"
            value={reminders.endTime}
            onChange={(event) => patch("endTime", event.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Quiet hours from" htmlFor="quietHoursStart">
          <Input
            type="time"
            value={reminders.quietHoursStart}
            onChange={(event) => patch("quietHoursStart", event.target.value)}
          />
        </Field>
        <Field label="Quiet hours until" htmlFor="quietHoursEnd">
          <Input
            type="time"
            value={reminders.quietHoursEnd}
            onChange={(event) => patch("quietHoursEnd", event.target.value)}
          />
        </Field>
      </div>

      <SettingsRow
        label="Alert sound"
        hint="An alarm-style beep when a reminder fires."
        htmlFor="sound-enabled"
      >
        <Switch
          id="sound-enabled"
          checked={reminders.soundEnabled}
          onCheckedChange={(value) => patch("soundEnabled", value)}
        />
      </SettingsRow>

      <VibrationRow
        enabled={reminders.vibrationEnabled}
        onChange={(value) => patch("vibrationEnabled", value)}
      />

      {/* Tone and length are only meaningful once a channel is switched on. */}
      {(reminders.soundEnabled || reminders.vibrationEnabled) && (
        <AlertSoundField
          tone={reminders.soundTone}
          beeps={reminders.soundBeeps}
          vibration={reminders.vibrationEnabled}
          soundEnabled={reminders.soundEnabled}
          onToneChange={(value) => patch("soundTone", value)}
          onBeepsChange={(value) => patch("soundBeeps", value)}
        />
      )}

      <SettingsRow
        label="Learn my pattern"
        hint="Time reminders around when you actually drink."
        htmlFor="adaptive"
      >
        <Switch
          id="adaptive"
          checked={reminders.adaptive}
          onCheckedChange={(value) => patch("adaptive", value)}
        />
      </SettingsRow>
    </SettingsSection>
  );
}

// --- Account ----------------------------------------------------------------

function AccountSection({ settings }: { settings: SettingsDto }) {
  const router = useRouter();

  const signOut = async () => {
    await api.post("/api/auth/logout").catch(() => undefined);
    router.replace("/login");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>{settings.user.email}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {settings.hasPassword ? <ChangePasswordDialog /> : null}
        {settings.googleLinked && (
          <Alert tone="info">This account is linked to Google.</Alert>
        )}

        <Button variant="outline" block onClick={signOut}>
          <LogOut aria-hidden />
          Sign out
        </Button>

        <DeleteAccountDialog />
      </CardContent>
    </Card>
  );
}

function ChangePasswordDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const form = useFormSubmit(async (event) => {
    const body = validateForm(changePasswordSchema, readFormFields(event.currentTarget));
    await api.post("/api/settings/password", body);
    setOpen(false);
    toast.success("Password updated", { description: "Sign in again with your new password." });
    router.replace("/login");
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" block>
          Change password
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change your password</DialogTitle>
          <DialogDescription>
            You&rsquo;ll be signed out on every device, including this one.
          </DialogDescription>
        </DialogHeader>

        <form {...form.formProps} className="space-y-4">
          {form.error && <Alert tone="error">{form.error}</Alert>}

          <Field label="Current password" htmlFor="currentPassword" error={form.fieldErrors.currentPassword}>
            <Input name="currentPassword" type="password" autoComplete="current-password" required />
          </Field>

          <Field
            label="New password"
            htmlFor="newPassword"
            hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
            error={form.fieldErrors.newPassword}
          >
            <Input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pending={form.isPending} ready={form.isReady}>
              Update password
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAccountDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState("");
  const [isPending, setIsPending] = React.useState(false);

  const remove = async () => {
    setIsPending(true);
    try {
      await api.delete("/api/account");
      router.replace("/");
      router.refresh();
    } catch {
      setIsPending(false);
      toast.error("We couldn't delete your account. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" block className="text-destructive hover:bg-destructive-soft">
          Delete account
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            This removes your account and every drink you&rsquo;ve logged. It can&rsquo;t be undone.
          </DialogDescription>
        </DialogHeader>

        <Field label='Type "delete" to confirm' htmlFor="confirm-delete">
          <Input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
          />
        </Field>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Keep my account
          </Button>
          <Button
            variant="destructive"
            disabled={confirmation.trim().toLowerCase() !== "delete" || isPending}
            onClick={remove}
          >
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
