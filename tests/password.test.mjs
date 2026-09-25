import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, validatePassword } from '@/lib/auth/password.ts';

describe('password hashing', () => {
  test('a correct password verifies', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    assert.equal(await verifyPassword('correct-horse-battery-staple', hash), true);
  });

  test('a wrong password does not', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    assert.equal(await verifyPassword('Correct-horse-battery-staple', hash), false);
    assert.equal(await verifyPassword('', hash), false);
  });

  test('the same password hashes differently every time', async () => {
    const [a, b] = await Promise.all([hashPassword('same-password-x'), hashPassword('same-password-x')]);
    assert.notEqual(a, b, 'a per-password salt is what stops rainbow tables');
    assert.equal(await verifyPassword('same-password-x', a), true);
    assert.equal(await verifyPassword('same-password-x', b), true);
  });

  test('the stored form carries its own cost parameters', async () => {
    const hash = await hashPassword('parameterised');
    const [scheme, N, r, p] = hash.split('$');
    assert.equal(scheme, 'scrypt');
    assert.ok(Number(N) >= 16384, 'cost must not be weakened by accident');
    assert.equal(Number(r), 8);
    assert.equal(Number(p), 1);
  });

  test('an old hash still verifies after the default cost is raised', async () => {
    // Simulates a hash written when N was lower: the parameters travel with
    // the hash, so raising the default must not lock existing users out.
    const legacy = await hashPassword('legacy-user-password');
    const [, , r, p, salt, digest] = legacy.split('$');
    const rewritten = ['scrypt', 16384, r, p, salt, digest].join('$');
    assert.equal(await verifyPassword('legacy-user-password', rewritten), true);
  });

  test('a corrupt or truncated hash fails closed instead of throwing', async () => {
    for (const bad of ['', 'garbage', 'scrypt$$$$', 'scrypt$16384$8$1$zz$zz', 'bcrypt$x$y']) {
      assert.equal(await verifyPassword('anything', bad), false, `"${bad}" must not verify`);
    }
  });

  test('unicode passwords normalise, so the same keystrokes always match', async () => {
    // U+00E9 vs e + U+0301 look identical and can come from different keyboards.
    const composed = 'passéword-long';
    const decomposed = 'passéword-long';
    const hash = await hashPassword(composed);
    assert.equal(await verifyPassword(decomposed, hash), true);
  });
});

describe('password policy', () => {
  test('rejects short passwords', () => {
    assert.equal(validatePassword('short').ok, false);
    assert.equal(validatePassword('123456789').ok, false);
  });

  test('rejects the passwords in every breach list', () => {
    assert.equal(validatePassword('password1').ok, false);
    assert.equal(validatePassword('PASSWORD1').ok, false, 'the check must be case-insensitive');
  });

  test('rejects a single repeated character', () => {
    assert.equal(validatePassword('aaaaaaaaaaaa').ok, false);
  });

  test('rejects an absurdly long password, which is a memory-exhaustion vector', () => {
    assert.equal(validatePassword('a'.repeat(5000)).ok, false);
  });

  test('accepts a reasonable passphrase', () => {
    assert.equal(validatePassword('marmalade tractor winter').ok, true);
  });

  test('every rejection explains itself', () => {
    for (const bad of ['short', 'password1', 'aaaaaaaaaaaa']) {
      const result = validatePassword(bad);
      assert.ok(result.reason && result.reason.length > 5, `"${bad}" rejected without a reason`);
    }
  });
});
