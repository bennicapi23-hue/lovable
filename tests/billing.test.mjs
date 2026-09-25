import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANS,
  getPlan,
  annualSaving,
  monthlyEquivalent,
  formatLimit,
} from '@/config/plans.config.ts';
import {
  checkAllowance,
  hasEntitlement,
  recordUsage,
  usageSnapshot,
  __resetUsage,
} from '@/lib/billing/entitlements.ts';

describe('plans', () => {
  test('plan ids are unique', () => {
    const ids = PLANS.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('exactly one plan is highlighted, so the recommendation is unambiguous', () => {
    assert.equal(PLANS.filter((p) => p.highlighted).length, 1);
  });

  test('limits and entitlements only grow as plans get more expensive', () => {
    const paid = PLANS.filter((p) => p.monthly !== null);
    for (let i = 1; i < paid.length; i += 1) {
      const prev = paid[i - 1];
      const curr = paid[i];
      assert.ok(
        curr.limits.buildsPerMonth >= prev.limits.buildsPerMonth,
        `${curr.id} offers fewer builds than ${prev.id}`,
      );
      for (const entitlement of prev.entitlements) {
        assert.ok(
          curr.entitlements.includes(entitlement),
          `${curr.id} silently drops "${entitlement}" that ${prev.id} includes`,
        );
      }
    }
  });

  test('annual billing really is cheaper than monthly', () => {
    for (const plan of PLANS) {
      if (!plan.monthly || !plan.annual) continue;
      assert.ok(plan.annual < plan.monthly * 12, `${plan.id} annual price is not a discount`);
      assert.ok(annualSaving(plan) > 0);
    }
  });

  test('getPlan falls back rather than returning undefined', () => {
    assert.equal(getPlan('nonexistent').id, PLANS[0].id);
    assert.equal(getPlan(undefined).id, PLANS[0].id);
    assert.equal(getPlan('team').id, 'team');
  });

  test('monthlyEquivalent is null where there is no published price', () => {
    assert.equal(monthlyEquivalent(getPlan('enterprise')), null);
    assert.ok(typeof monthlyEquivalent(getPlan('pro')) === 'number');
  });

  test('formatLimit renders infinity as words, not as Infinity', () => {
    assert.equal(formatLimit(Number.POSITIVE_INFINITY), 'Unlimited');
    assert.equal(formatLimit(1000), '1,000');
  });
});

describe('entitlements', () => {
  const free = { id: 'acct-free', planId: 'free' };
  const pro = { id: 'acct-pro', planId: 'pro' };

  beforeEach(() => __resetUsage());

  test('capabilities follow the plan', () => {
    assert.equal(hasEntitlement(free, 'byok'), false);
    assert.equal(hasEntitlement(pro, 'byok'), true);
    assert.equal(hasEntitlement(free, 'export'), true, 'export must be on every plan');
  });

  test('a fresh account is allowed and sees its full allowance', () => {
    const check = checkAllowance(free, 'build');
    assert.equal(check.allowed, true);
    assert.equal(check.remaining, getPlan('free').limits.buildsPerMonth);
  });

  test('allowance depletes as usage is recorded', () => {
    recordUsage(free, 'build', 3);
    assert.equal(checkAllowance(free, 'build').remaining, getPlan('free').limits.buildsPerMonth - 3);
  });

  test('refuses once the monthly allowance is spent, and says why', () => {
    recordUsage(free, 'build', getPlan('free').limits.buildsPerMonth);
    const check = checkAllowance(free, 'build');
    assert.equal(check.allowed, false);
    assert.equal(check.remaining, 0);
    assert.match(check.reason, /Starter/);
    assert.ok(check.resetsAt, 'the user must be told when it resets');
  });

  test('builds and edits are metered separately', () => {
    recordUsage(free, 'build', getPlan('free').limits.buildsPerMonth);
    assert.equal(checkAllowance(free, 'build').allowed, false);
    assert.equal(checkAllowance(free, 'edit').allowed, true, 'edits must survive a build lockout');
  });

  test('accounts do not share counters', () => {
    recordUsage(free, 'build', 5);
    assert.equal(checkAllowance(pro, 'build').remaining, getPlan('pro').limits.buildsPerMonth);
  });

  test('an unlimited plan is never refused', () => {
    const enterprise = { id: 'acct-ent', planId: 'enterprise' };
    recordUsage(enterprise, 'build', 100000);
    assert.equal(checkAllowance(enterprise, 'build').allowed, true);
  });

  test('the usage snapshot reports what a dashboard needs', () => {
    recordUsage(pro, 'build', 2);
    recordUsage(pro, 'edit', 7);
    const snap = usageSnapshot(pro);
    assert.equal(snap.builds.used, 2);
    assert.equal(snap.edits.used, 7);
    assert.equal(snap.plan.id, 'pro');
    assert.ok(Date.parse(snap.resetsAt) > Date.now(), 'reset must be in the future');
  });
});
