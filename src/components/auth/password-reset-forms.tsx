"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { api } from "@/lib/api-client";
import { readFormFields, validateForm } from "@/lib/form-validation";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { useFormSubmit } from "@/hooks/use-form-submit";
import { forgotPasswordSchema, resetPasswordSchema } from "@/server/validation/schemas";

/** Step one: ask for the address. */
export function ForgotPasswordForm() {
  const [sent, setSent] = React.useState<string | null>(null);

  const form = useFormSubmit(async (event) => {
    const body = validateForm(forgotPasswordSchema, readFormFields(event.currentTarget));
    const result = await api.post<{ message: string; devResetUrl?: string }>(
      "/api/auth/forgot-password",
      body,
    );
    setSent(result.devResetUrl ?? "");
  });

  if (sent !== null) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
        <Alert tone="success">
          If that email has an account, a reset link is on its way. It expires in 30 minutes.
        </Alert>
        {sent && (
          // Development convenience: no mail provider is wired up locally.
          <Alert tone="info">
            Development link:{" "}
            <Link href={sent.replace(/^https?:\/\/[^/]+/, "")} className="font-medium underline">
              open reset page
            </Link>
          </Alert>
        )}
        <Button asChild variant="outline" block>
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          We&rsquo;ll email you a link to set a new one.
        </p>
      </header>

      <form {...form.formProps} className="space-y-4">
        {form.error && <Alert tone="error">{form.error}</Alert>}

        <Field label="Email" htmlFor="email" error={form.fieldErrors.email}>
          <Input name="email" type="email" autoComplete="email" required autoFocus />
        </Field>

        <SubmitButton size="lg" block pending={form.isPending} ready={form.isReady}>
          Send reset link
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

/** Step two: set the new password using the token from the link. */
export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = React.useState(false);

  const form = useFormSubmit(async (event) => {
    // The token isn't a visible field, so a problem with it surfaces in the
    // banner (see `useFormSubmit`) rather than disappearing.
    const body = validateForm(resetPasswordSchema, { ...readFormFields(event.currentTarget), token });
    await api.post("/api/auth/reset-password", body);
    setDone(true);
    setTimeout(() => router.replace("/login"), 1800);
  });

  if (!token) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight">This link looks incomplete</h1>
        <Alert tone="error">Request a fresh reset link and try again.</Alert>
        <Button asChild block>
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight">Password updated</h1>
        <Alert tone="success">Taking you to sign in…</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">
          You&rsquo;ll be signed out everywhere else, just to be safe.
        </p>
      </header>

      <form {...form.formProps} className="space-y-4">
        {form.error && <Alert tone="error">{form.error}</Alert>}

        <Field
          label="New password"
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
            autoFocus
          />
        </Field>

        <SubmitButton size="lg" block pending={form.isPending} ready={form.isReady}>
          Update password
        </SubmitButton>
      </form>
    </div>
  );
}
