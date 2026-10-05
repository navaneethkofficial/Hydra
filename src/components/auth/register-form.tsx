"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { register } from "@/lib/auth-client";
import { readFormFields, validateForm } from "@/lib/form-validation";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { detectTimezone, useFormSubmit } from "@/hooks/use-form-submit";
import { registerSchema } from "@/server/validation/schemas";

export function RegisterForm() {
  const router = useRouter();

  const form = useFormSubmit(async (event) => {
    // Checked in the browser first for instant feedback; the API re-checks.
    const details = validateForm(registerSchema, readFormFields(event.currentTarget));
    await register({ ...details, timezone: detectTimezone() });

    // New accounts always land in onboarding — four questions, not a form.
    router.replace("/onboarding");
    router.refresh();
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Start your hydration journey</h1>
        <p className="text-sm text-muted-foreground">
          Four quick questions and you&rsquo;re set. Under a minute.
        </p>
      </header>

      <form {...form.formProps} className="space-y-4">
        {form.error && <Alert tone="error">{form.error}</Alert>}

        <Field label="Name" htmlFor="name" error={form.fieldErrors.name}>
          <Input name="name" autoComplete="given-name" placeholder="Alex" required autoFocus />
        </Field>

        <Field label="Email" htmlFor="email" error={form.fieldErrors.email}>
          <Input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          error={form.fieldErrors.password}
        >
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </Field>

        <SubmitButton
          size="lg"
          block
          pending={form.isPending}
          ready={form.isReady}
          pendingLabel="Creating your account…"
        >
          Create account
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
