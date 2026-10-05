import "server-only";
import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

import { CHECK_FIELDS_MESSAGE, toFieldErrors } from "@/lib/form-validation";
import { getSessionUser, type SessionUser } from "@/server/auth/session";
import { ApiError, badRequest, unauthorized } from "./errors";
import { checkRateLimit, RATE_LIMITS, type RateLimitRule } from "./rate-limit";
import { errorResponse, ok } from "./response";

/**
 * Route definition helper.
 *
 * Route files stay thin on purpose: parse, authorise, delegate to a service,
 * respond. Auth, rate limiting, body validation and error mapping all live here
 * so no endpoint can forget one of them, and so the exact same services can be
 * mounted on a different transport (a mobile BFF, a cron worker) later.
 */

export interface RouteContext<TBody, TUser> {
  request: NextRequest;
  body: TBody;
  user: TUser;
  params: Record<string, string>;
  searchParams: URLSearchParams;
}

interface RouteOptions<TSchema extends ZodType | undefined> {
  /** Require a signed-in user. Defaults to true — opting out must be explicit. */
  auth?: boolean;
  /** Zod schema for the JSON body. Its output type flows into the handler. */
  schema?: TSchema;
  rateLimit?: RateLimitRule | keyof typeof RATE_LIMITS | false;
}

type Body<TSchema> = TSchema extends ZodType<infer TOut> ? TOut : undefined;

type NextRouteArgs = { params: Promise<Record<string, string>> };

// Order matters: the `auth: false` signature must be tried first, or a public
// route would type its `user` as a `SessionUser` that is really `null`.
export function defineRoute<TSchema extends ZodType | undefined = undefined>(
  options: RouteOptions<TSchema> & { auth: false },
  handler: (context: RouteContext<Body<TSchema>, null>) => Promise<NextResponse | unknown>,
): (request: NextRequest, args?: NextRouteArgs) => Promise<NextResponse>;

export function defineRoute<TSchema extends ZodType | undefined = undefined>(
  options: RouteOptions<TSchema>,
  handler: (
    context: RouteContext<Body<TSchema>, SessionUser>,
  ) => Promise<NextResponse | unknown>,
): (request: NextRequest, args?: NextRouteArgs) => Promise<NextResponse>;

export function defineRoute<TSchema extends ZodType | undefined = undefined>(
  options: RouteOptions<TSchema>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (context: RouteContext<any, any>) => Promise<NextResponse | unknown>,
) {
  const requireAuth = options.auth !== false;

  return async function route(request: NextRequest, args?: NextRouteArgs): Promise<NextResponse> {
    try {
      const user = requireAuth ? await getSessionUser() : null;
      if (requireAuth && !user) throw unauthorized();

      applyRateLimit(request, options.rateLimit, user?.id);

      const body = options.schema ? await parseBody(request, options.schema) : undefined;
      const params = args?.params ? await args.params : {};

      const result = await handler({
        request,
        body,
        user,
        params,
        searchParams: request.nextUrl.searchParams,
      });

      return isResponse(result) ? result : ok(result);
    } catch (error) {
      return errorResponse(toApiError(error));
    }
  };
}

// ---------------------------------------------------------------------------

function applyRateLimit(
  request: NextRequest,
  rule: RouteOptions<ZodType | undefined>["rateLimit"],
  userId?: string,
): void {
  if (rule === false) return;

  const resolved: RateLimitRule =
    typeof rule === "string" ? RATE_LIMITS[rule] : (rule ?? RATE_LIMITS.read);
  // Signed-in users are limited per account; anonymous callers per IP.
  const identity = userId ?? clientIp(request);
  const result = checkRateLimit(`${request.nextUrl.pathname}:${identity}`, resolved);

  if (!result.allowed) {
    throw new ApiError("RATE_LIMITED", "That's a lot of requests. Give it a moment and try again.", {
      retryAfter: result.retryAfter,
    });
  }
}

async function parseBody<TSchema extends ZodType>(
  request: NextRequest,
  schema: TSchema,
): Promise<unknown> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest("We couldn't read that request.");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw badRequest(CHECK_FIELDS_MESSAGE, toFieldErrors(parsed.error));
  return parsed.data;
}

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof ZodError) {
    return badRequest(CHECK_FIELDS_MESSAGE, toFieldErrors(error));
  }

  // Anything unexpected is logged in full but surfaced as a friendly sentence:
  // stack traces and Prisma messages must never reach a user.
  console.error("[api] unhandled error", error);
  return new ApiError("INTERNAL", "Something went wrong on our side. Please try again.");
}

function isResponse(value: unknown): value is NextResponse {
  return typeof Response !== "undefined" && value instanceof Response;
}
