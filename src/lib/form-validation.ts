import type { ZodError, ZodType, z } from "zod";

/**
 * Form validation shared by the browser and the API.
 *
 * The server validates every body with the schemas in
 * `server/validation/schemas.ts`. Running the same schemas in the browser gives
 * instant feedback without a round trip, and because both sides flatten Zod
 * issues through `toFieldErrors`, a message reads the same wherever it was
 * produced. The server stays the authority; this is a fast path, not a gate.
 */

/** Per-field messages keyed by the form control's `name`. */
export type FieldErrors = Record<string, string>;

/** Key used for an issue that belongs to the whole form rather than one field. */
export const FORM_ERROR_KEY = "form";

/** The banner shown alongside highlighted fields, on either side of the wire. */
export const CHECK_FIELDS_MESSAGE = "Please check the highlighted fields.";

/**
 * Flattens Zod issues into `{ field: message }` so forms can render them inline.
 * Nested paths join with dots (`profile.name`); the first issue per field wins,
 * since one clear message beats a list.
 */
export function toFieldErrors(error: ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || FORM_ERROR_KEY;
    fields[key] ??= issue.message;
  }
  return fields;
}

/** Thrown by `validateForm` when input fails its schema in the browser. */
export class FormValidationError extends Error {
  readonly fields: FieldErrors;

  constructor(fields: FieldErrors, message = CHECK_FIELDS_MESSAGE) {
    super(message);
    this.name = "FormValidationError";
    this.fields = fields;
  }
}

/**
 * Parses `input` with `schema`, returning the typed output or throwing a
 * `FormValidationError`. `useFormSubmit` renders that error exactly like a
 * server-side validation failure, so a form needs no extra wiring.
 */
export function validateForm<TSchema extends ZodType>(schema: TSchema, input: unknown): z.output<TSchema> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new FormValidationError(toFieldErrors(parsed.error));
  return parsed.data;
}

/**
 * Reads a form's text controls into a plain object, ready for `validateForm`.
 * File inputs are skipped; a repeated name keeps its last value.
 */
export function readFormFields(form: HTMLFormElement): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of new FormData(form)) {
    if (typeof value === "string") values[name] = value;
  }
  return values;
}

/** True for any error that carries per-field messages, from either side of the wire. */
export function hasFieldErrors(error: unknown): error is Error & { fields: FieldErrors } {
  if (!(error instanceof Error) || !("fields" in error)) return false;
  const { fields } = error as { fields?: unknown };
  return typeof fields === "object" && fields !== null && Object.keys(fields).length > 0;
}
