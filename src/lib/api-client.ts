/**
 * The browser's single door to the API.
 *
 * Every request goes through here so error handling, the response envelope and
 * the offline signal are dealt with in one place rather than in every component.
 */

import type { ErrorCode } from "@/server/http/errors";

export class ApiClientError extends Error {
  readonly code: ErrorCode | "OFFLINE";
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(
    code: ErrorCode | "OFFLINE",
    message: string,
    status: number,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }

  /** True when retrying later is likely to work — drives the offline outbox. */
  get isRetryable(): boolean {
    return this.code === "OFFLINE" || this.status >= 500 || this.status === 0;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /** Query parameters; `undefined` values are dropped. */
  query?: Record<string, string | number | undefined>;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal, query } = options;

  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      signal,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    // A failed fetch is a lost connection, not a server refusal — the caller
    // can queue the write and replay it.
    throw new ApiClientError("OFFLINE", "You appear to be offline.", 0);
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (payload as { error?: { code: ErrorCode; message: string; fields?: Record<string, string> } })
      ?.error;
    throw new ApiClientError(
      error?.code ?? "INTERNAL",
      error?.message ?? "Something went wrong. Please try again.",
      response.status,
      error?.fields,
    );
  }

  return (payload as { data: T }).data;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "DELETE" }),
};
