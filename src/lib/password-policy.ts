/**
 * Password rules shared by the server (hashing, validation) and the browser
 * (instant form feedback).
 *
 * Kept free of `node:crypto` and `server-only` so client components can import
 * it; the hashing itself stays in `server/auth/password.ts`.
 */

export const MIN_PASSWORD_LENGTH = 8;

/** Bounds scrypt's work per request, so a huge payload can't be used to stall the server. */
export const MAX_PASSWORD_LENGTH = 128;
