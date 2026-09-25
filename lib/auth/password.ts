import { randomBytes, scrypt, type ScryptOptions, timingSafeEqual } from 'node:crypto';

/**
 * promisify() picks the overload without options, so the cost parameters
 * would be silently dropped. Wrapping it by hand keeps them.
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derived) =>
      err ? reject(err) : resolve(derived),
    );
  });
}

/**
 * Password hashing with scrypt from Node's standard library.
 *
 * scrypt is memory-hard, so it resists the GPU attacks that make plain
 * SHA-family hashes useless for passwords. Using the built-in avoids a
 * native dependency that would break on serverless runtimes — which is the
 * usual reason projects end up shipping something weaker.
 *
 * Stored form is `scrypt$N$r$p$<salt hex>$<hash hex>`. The parameters travel
 * with the hash so they can be raised later without invalidating existing
 * passwords: an old hash still verifies against its own parameters.
 */

const PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };
const SALT_BYTES = 16;

/**
 * Strict hex decode.
 *
 * Buffer.from(hex, 'hex') silently drops anything that is not a hex pair, so
 * "zz" decodes to an empty buffer rather than failing. Combined with
 * timingSafeEqual — which reports two empty buffers as equal — that turns a
 * corrupted row into an account that accepts any password. Decoding strictly
 * and rejecting empties closes that.
 */
function decodeHex(value: string): Buffer | null {
  if (!value || value.length % 2 !== 0) return null;
  if (!/^[0-9a-fA-F]+$/.test(value)) return null;
  const buffer = Buffer.from(value, 'hex');
  return buffer.length > 0 ? buffer : null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password.normalize('NFKC'), salt, PARAMS.keylen, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p,
    // scrypt needs headroom above N*r*128 or Node refuses the call.
    maxmem: 64 * 1024 * 1024,
  });

  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('hex'),
    derived.toString('hex'),
  ].join('$');
}

/**
 * Verifies a password against a stored hash.
 *
 * Returns false rather than throwing on a malformed hash: a corrupt row must
 * fail the login, not crash the sign-in route.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, n, r, p, saltHex, hashHex] = stored.split('$');
    if (scheme !== 'scrypt') return false;

    const salt = decodeHex(saltHex);
    const expected = decodeHex(hashHex);
    if (!salt || !expected) return false;

    // Cost parameters must be sane numbers, or scrypt is called with NaN and
    // whatever it does then is not something to authenticate against.
    const cost = { N: Number(n), r: Number(r), p: Number(p) };
    if (!Number.isInteger(cost.N) || cost.N < 1024) return false;
    if (!Number.isInteger(cost.r) || cost.r < 1) return false;
    if (!Number.isInteger(cost.p) || cost.p < 1) return false;

    const derived = await scryptAsync(password.normalize('NFKC'), salt, expected.length, {
      N: cost.N,
      r: cost.r,
      p: cost.p,
      maxmem: 64 * 1024 * 1024,
    });

    // Lengths must match before timingSafeEqual, which throws otherwise.
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * Minimum bar for a new password.
 *
 * Length does more for entropy than character-class rules, which mostly
 * produce "Password1!" — so the rule is length, plus a check against the
 * handful of passwords that show up in every breach list.
 */
const OBVIOUS = new Set([
  'password', 'password1', 'passw0rd', '12345678', '123456789', 'qwertyui',
  'iloveyou', 'admin123', 'letmein1', 'welcome1', 'changeme', 'kiln1234',
]);

export function validatePassword(password: string): { ok: boolean; reason?: string } {
  if (password.length < 10) {
    return { ok: false, reason: 'Use at least 10 characters.' };
  }
  if (password.length > 200) {
    return { ok: false, reason: 'That password is too long (200 characters max).' };
  }
  if (OBVIOUS.has(password.toLowerCase())) {
    return { ok: false, reason: 'That password appears in every breach list. Pick another.' };
  }
  if (/^(.)\1+$/.test(password)) {
    return { ok: false, reason: 'A single repeated character is not a password.' };
  }
  return { ok: true };
}
