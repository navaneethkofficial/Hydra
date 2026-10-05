import "server-only";
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with scrypt — memory-hard, in Node's standard library, and
 * therefore one fewer native dependency to keep patched than bcrypt/argon2.
 *
 * Stored format: `scrypt$N$r$p$saltB64$hashB64`, so the parameters travel with
 * the hash and can be raised later without invalidating existing passwords.
 */

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derived) =>
      error ? reject(error) : resolve(derived),
    );
  });
}

const PARAMS = { N: 16_384, r: 8, p: 1, keyLength: 64 } as const;
const SALT_BYTES = 16;

// Length rules live in `@/lib/password-policy`, shared with the client forms.

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password.normalize("NFKC"), salt, PARAMS.keyLength, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p,
    maxmem: 64 * 1024 * 1024,
  });

  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64 ?? "", "base64");
  const expected = Buffer.from(hashB64 ?? "", "base64");
  if (salt.length === 0 || expected.length === 0) return false;

  try {
    const derived = await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
      N: Number(nRaw),
      r: Number(rRaw),
      p: Number(pRaw),
      maxmem: 64 * 1024 * 1024,
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * Burns roughly the same time as a real verification.
 *
 * Called when an email does not exist, so the response time cannot be used to
 * enumerate which addresses have accounts.
 */
export async function fakeVerify(): Promise<void> {
  await scryptAsync("timing-equaliser", randomBytes(SALT_BYTES), PARAMS.keyLength, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p,
    maxmem: 64 * 1024 * 1024,
  });
}
