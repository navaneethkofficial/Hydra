"use client";

import * as React from "react";

import { ApiClientError } from "@/lib/api-client";
import { hasFieldErrors, type FieldErrors } from "@/lib/form-validation";
import { useHydrated } from "@/hooks/use-hydrated";

/**
 * Form submission state.
 *
 * Every form in the product needs the same things: a pending flag, a
 * top-level message, per-field errors, and the guarantee that a failed submit
 * leaves the user's typing untouched. Doing it once here is what keeps the
 * forms themselves down to markup.
 *
 * Usage:
 *
 * ```tsx
 * const form = useFormSubmit(async (event) => {
 *   const values = validateForm(schema, readFormFields(event.currentTarget));
 *   await api.post("/api/thing", values);
 * });
 *
 * <form {...form.formProps}>
 *   {form.error && <Alert tone="error">{form.error}</Alert>}
 *   <Field label="Email" htmlFor="email" error={form.fieldErrors.email}>…</Field>
 *   <SubmitButton pending={form.isPending} ready={form.isReady}>Save</SubmitButton>
 * </form>
 * ```
 *
 * The action may throw anything. Errors that carry `fields` (a server 400, or a
 * `FormValidationError` from `validateForm`) highlight the matching controls;
 * everything else becomes the banner message.
 */

export interface FormSubmitState {
  isPending: boolean;
  /** Banner message, or `null` when the errors are all shown inline. */
  error: string | null;
  /** The API's machine-readable code for the last failure, for forms that tailor their help. */
  errorCode: ApiClientError["code"] | null;
  fieldErrors: FieldErrors;
}

/** Attributes every form using this hook should spread onto its `<form>`. */
export interface FormSubmitProps {
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  /**
   * A native submit can only happen before hydration, and the submit button is
   * disabled until then. `post` is the backstop: if one slips through anyway,
   * field values travel in the request body instead of the URL, where a
   * password would land in history, logs and the Referer header.
   */
  method: "post";
  /** Validation messages come from the shared schemas, not the browser's own bubbles. */
  noValidate: true;
}

const INITIAL_STATE: FormSubmitState = {
  isPending: false,
  error: null,
  errorCode: null,
  fieldErrors: {},
};

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

export function useFormSubmit<TResult>(action: (event: React.FormEvent<HTMLFormElement>) => Promise<TResult>) {
  const [state, setState] = React.useState<FormSubmitState>(INITIAL_STATE);
  // Before hydration there is no `onSubmit` handler; a submit then would be a
  // plain browser navigation. Forms disable their submit button until ready.
  const isReady = useHydrated();

  const onSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      // `currentTarget` is only set while the event is dispatching; keep the
      // element for the error path, which runs after an await.
      const formElement = event.currentTarget;
      setState({ ...INITIAL_STATE, isPending: true });

      try {
        await action(event);
        setState((current) => ({ ...current, isPending: false }));
      } catch (error) {
        setState({ isPending: false, ...describeFailure(error, formElement) });
      }
    },
    [action],
  );

  const clearError = React.useCallback(
    () => setState((current) => ({ ...current, error: null, errorCode: null, fieldErrors: {} })),
    [],
  );

  const formProps: FormSubmitProps = { onSubmit, method: "post", noValidate: true };

  return { ...state, isReady, formProps, clearError };
}

/** Turns whatever the action threw into banner and inline messages. */
function describeFailure(error: unknown, form: HTMLFormElement): Omit<FormSubmitState, "isPending"> {
  const errorCode = error instanceof ApiClientError ? error.code : null;

  if (hasFieldErrors(error)) {
    // Inline messages make a banner noise, unless a message targets a field
    // this form doesn't render (a hidden value, or a whole-form rule). Then it
    // goes in the banner, because otherwise it would never be seen.
    const unrendered = Object.keys(error.fields).filter((name) => form.elements.namedItem(name) === null);
    const banner = unrendered[0] !== undefined ? error.fields[unrendered[0]] : null;
    return { error: banner ?? null, errorCode, fieldErrors: error.fields };
  }

  return {
    error: error instanceof Error && error.message ? error.message : FALLBACK_MESSAGE,
    errorCode,
    fieldErrors: {},
  };
}

/** The browser's best guess at the user's timezone, sent with auth requests. */
export function detectTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}
