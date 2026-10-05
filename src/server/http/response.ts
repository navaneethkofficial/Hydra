import { NextResponse } from "next/server";

import { ApiError, type ErrorCode } from "./errors";

/**
 * The single response envelope for every endpoint.
 *
 * `{ data }` or `{ error }` — nothing else. A mobile client can parse one shape
 * and the web client's fetch wrapper has one branch.
 */

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, string>;
  };
}

export type ApiResponse<T> = { data: T } | ApiErrorBody;

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, { status: 200, ...init });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function errorResponse(error: ApiError): NextResponse {
  const headers = new Headers();
  if (error.retryAfter) headers.set("Retry-After", String(error.retryAfter));

  return NextResponse.json<ApiErrorBody>(
    {
      error: { code: error.code, message: error.message, ...(error.fields && { fields: error.fields }) },
    },
    { status: error.status, headers },
  );
}
