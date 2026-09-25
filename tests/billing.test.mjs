import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANS,
  getPlan,
  annualSaving,
  monthlyEquivalent,
  formatLimit,
} from '@/config/plans.config.ts';
import { hasEntitlement } from '@/lib/billing/entitlements.ts';

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

describe('entitlements — plan capabilities', () => {
  test('capabilities follow the plan', () => {
    const free = { id: 'u1', planId: 'free' };
    const pro = { id: 'u2', planId: 'pro' };
    assert.equal(hasEntitlement(free, 'byok'), false);
    assert.equal(hasEntitlement(pro, 'byok'), true);
    assert.equal(hasEntitlement(free, 'export'), true, 'export must be on every plan');
  });
});
