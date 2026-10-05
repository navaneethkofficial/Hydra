"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { signIn } from "@/lib/auth-client";
import { readFormFields, validateForm } from "@/lib/form-validation";
import { detectTimezone, useFormSubmit } from "@/hooks/use-form-submit";
import { loginSchema } from "@/server/validation/schemas";

const OAUTH_ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in isn't set up on this deployment yet.",
  google_state: "That sign-in attempt expired. Please try again.",
  google_exchange: "We couldn't complete the Google sign-in. Please try again.",
  google_email: "Your Google account needs a verified email address.",
  google_failed: "Something went wrong with Google sign-in. Please try again.",
};

export interface LoginFormProps {
  /**
   * Google sign-in is offered on this deployment. Accounts created through
   * Google have no password, so after a rejected attempt the form points
   * there rather than leaving the user to guess.
   */
  googleEnabled?: boolean;
}

export function LoginForm({ googleEnabled = false }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");

  const form = useFormSubmit(async (event) => {
    // Checked in the browser first for instant feedback; the API re-checks.
    const credentials = validateForm(loginSchema, readFormFields(event.currentTarget));
    const result = await signIn({ ...credentials, timezone: detectTimezone() });

    router.replace(result.needsOnboarding ? "/onboarding" : "/today");
    router.refresh();
  });

  const showGoogleHint = googleEnabled && form.errorCode === "INVALID_CREDENTIALS";

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Pick up your streak where you left off.</p>
      </header>

      {oauthError && (
        <Alert tone="error">{OAUTH_ERRORS[oauthError] ?? "Sign-in failed. Please try again."}</Alert>
      )}

      <form {...form.formProps} className="space-y-4">
        {form.error && (
          <Alert tone="error">
            {form.error}
            {showGoogleHint && " Signed up with Google? Use the Google button above."}
          </Alert>
        )}

        <Field label="Email" htmlFor="email" error={form.fieldErrors.email}>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            autoFocus
          />
        </Field>

        <Field label="Password" htmlFor="password" error={form.fieldErrors.password}>
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>

        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            Forgot your password?
          </Link>
        </div>

        <SubmitButton size="lg" block pending={form.isPending} ready={form.isReady} pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
