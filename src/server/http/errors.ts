/**
 * Application errors.
 *
 * Services throw these; the route wrapper is the only place that turns them
 * into HTTP. Messages are written for the person reading them on screen —
 * "Something went wrong while saving your drink", never "Error 500".
 */

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** Per-field messages, keyed by form field name. */
  readonly fields?: Record<string, string>;
  /** Seconds until a rate-limited caller may retry. */
  readonly retryAfter?: number;

  constructor(
    code: ErrorCode,
    message: string,
    options: { fields?: Record<string, string>; retryAfter?: number } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.fields = options.fields;
    this.retryAfter = options.retryAfter;
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new ApiError("BAD_REQUEST", message, { fields });

export const unauthorized = (message = "Please sign in to continue.") =>
  new ApiError("UNAUTHORIZED", message);

/**
 * A sign-in attempt that didn't match an account. Deliberately one code and one
 * message for "no such email" and "wrong password", so the response can't be
 * used to find out who has an account. Distinct from `UNAUTHORIZED` ("you are
 * not signed in") so the client can offer sign-in-specific help.
 */
export const invalidCredentials = () =>
  new ApiError("INVALID_CREDENTIALS", "That email or password doesn't look right.");

export const forbidden = (message = "You don't have access to that.") =>
  new ApiError("FORBIDDEN", message);

export const notFound = (message = "We couldn't find that.") => new ApiError("NOT_FOUND", message);

export const conflict = (message: string, fields?: Record<string, string>) =>
  new ApiError("CONFLICT", message, { fields });

export const rateLimited = (retryAfter: number) =>
  new ApiError("RATE_LIMITED", "That's a lot of requests. Give it a moment and try again.", {
    retryAfter,
  });
