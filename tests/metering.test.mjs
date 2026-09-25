import test, { describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Metering against a real database.
 *
 * The counters used to live in a process Map, so they reset on every deploy
 * and a user on a second instance got a fresh allowance. These tests run
 * against an actual libSQL file to prove the limits now persist — an
 * in-memory fake would test the fake, not the thing that broke.
 */

const dir = mkdtempSync(join(tmpdir(), 'kiln-test-'));
process.env.DATABASE_URL = `file:${join(dir, 'test.db')}`;

const { createClient } = await import('@libsql/client');
const { drizzle } = await import('drizzle-orm/libsql');
const { migrate } = await import('drizzle-orm/libsql/migrator');
const { getDb, users } = await import('@/lib/db/index.ts');
const { checkAllowance, recordUsage, currentPeriod, periodResetsAt, usageSnapshot } =
  await import('@/lib/billing/entitlements.ts');
const { getPlan } = await import('@/config/plans.config.ts');

const free = { id: 'user-free', planId: 'free' };
const pro = { id: 'user-pro', planId: 'pro' };
const enterprise = { id: 'user-ent', planId: 'enterprise' };

before(async () => {
  const client = createClient({ url: process.env.DATABASE_URL });
  await migrate(drizzle(client), { migrationsFolder: './lib/db/migrations' });
  client.close();

  await getDb().insert(users).values([
    { id: free.id, email: 'free@example.com', planId: 'free' },
    { id: pro.id, email: 'pro@example.com', planId: 'pro' },
    { id: enterprise.id, email: 'ent@example.com', planId: 'enterprise' },
  ]);
});

after(() => rmSync(dir, { recursive: true, force: true }));

beforeEach(async () => {
  const { usage } = await import('@/lib/db/index.ts');
  await getDb().delete(usage);
});

describe('metering', () => {
  test('a fresh account sees its full allowance', async () => {
    const check = await checkAllowance(free, 'build');
    assert.equal(check.allowed, true);
    assert.equal(check.remaining, getPlan('free').limits.buildsPerMonth);
  });

  test('allowance depletes as usage is recorded, and survives a re-read', async () => {
    await recordUsage(free, 'build');
    await recordUsage(free, 'build');
    const check = await checkAllowance(free, 'build');
    assert.equal(check.remaining, getPlan('free').limits.buildsPerMonth - 2);
  });

  test('concurrent builds cannot both consume the same slot', async () => {
    // The increment happens in SQL, not JavaScript, so ten parallel writes
    // must land as ten — a read-modify-write would lose most of them.
    await Promise.all(Array.from({ length: 10 }, () => recordUsage(pro, 'build')));
    const snapshot = await usageSnapshot(pro);
    assert.equal(snapshot.builds.used, 10);
  });

  test('refuses once the allowance is spent, and says when it returns', async () => {
    const limit = getPlan('free').limits.buildsPerMonth;
    await Promise.all(Array.from({ length: limit }, () => recordUsage(free, 'build')));

    const check = await checkAllowance(free, 'build');
    assert.equal(check.allowed, false);
    assert.equal(check.remaining, 0);
    assert.match(check.reason, /Starter/);
    assert.ok(Date.parse(check.resetsAt) > Date.now());
  });

  test('builds and edits are metered separately', async () => {
    const limit = getPlan('free').limits.buildsPerMonth;
    await Promise.all(Array.from({ length: limit }, () => recordUsage(free, 'build')));
    assert.equal((await checkAllowance(free, 'build')).allowed, false);
    assert.equal((await checkAllowance(free, 'edit')).allowed, true,
      'an edit must survive a build lockout');
  });

  test('accounts do not share counters', async () => {
    await recordUsage(free, 'build', 5);
    const check = await checkAllowance(pro, 'build');
    assert.equal(check.remaining, getPlan('pro').limits.buildsPerMonth);
  });

  test('an unlimited plan is never refused', async () => {
    await recordUsage(enterprise, 'build', 100_000);
    assert.equal((await checkAllowance(enterprise, 'build')).allowed, true);
  });

  test('the period is the UTC month, and resets at its boundary', () => {
    const period = currentPeriod(new Date('2026-03-17T12:00:00Z'));
    assert.equal(period, '2026-03');
    assert.equal(
      periodResetsAt(new Date('2026-03-17T12:00:00Z')).toISOString(),
      '2026-04-01T00:00:00.000Z',
    );
  });

  test('December rolls into the next year rather than month 13', () => {
    assert.equal(currentPeriod(new Date('2026-12-31T23:59:59Z')), '2026-12');
    assert.equal(
      periodResetsAt(new Date('2026-12-31T23:59:59Z')).toISOString(),
      '2027-01-01T00:00:00.000Z',
    );
  });
});
