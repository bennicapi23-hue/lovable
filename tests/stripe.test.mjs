import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isBillingConfigured,
  priceIdFor,
  planForPriceId,
  purchasablePlans,
  accountIdFrom,
  getStripe,
} from '@/lib/billing/stripe.ts';

const KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PRICE_PRO_MONTHLY', 'STRIPE_PRICE_PRO_ANNUAL',
  'STRIPE_PRICE_TEAM_MONTHLY', 'STRIPE_PRICE_TEAM_ANNUAL',
  'STRIPE_PRICE_FREE_MONTHLY',
];
let saved;

describe('billing configuration', () => {
  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    for (const k of KEYS) delete process.env[k];
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });

  test('an install with no Stripe key still runs, selling nothing', () => {
    assert.equal(isBillingConfigured(), false);
    assert.deepEqual(purchasablePlans(), [],
      'a self-hosted install must not need a payment processor');
  });

  test('reaching for Stripe when it is unconfigured fails loudly', () => {
    assert.throws(() => getStripe(), /not configured/i);
  });

  test('a plan with no configured price cannot be sold', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    assert.deepEqual(purchasablePlans(), [],
      'keys alone are not enough — refusing beats charging the wrong amount');

    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_m';
    assert.deepEqual(purchasablePlans(), ['pro']);
  });

  test('free and enterprise are never purchasable', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_m';
    process.env.STRIPE_PRICE_FREE_MONTHLY = 'price_free_m';

    const sellable = purchasablePlans();
    assert.ok(!sellable.includes('free'), 'a free plan must not go through checkout');
    assert.ok(!sellable.includes('enterprise'), 'enterprise is a conversation, not a checkout');
  });

  test('price ids come from the environment, so test and live never mix', () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_live_abc';
    assert.equal(priceIdFor('pro', 'monthly'), 'price_live_abc');
    assert.equal(priceIdFor('pro', 'annual'), null);
    assert.equal(priceIdFor('team', 'monthly'), null);
  });

  test('a price maps back to exactly one plan', () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_m';
    process.env.STRIPE_PRICE_PRO_ANNUAL = 'price_pro_a';
    process.env.STRIPE_PRICE_TEAM_MONTHLY = 'price_team_m';

    assert.equal(planForPriceId('price_pro_m'), 'pro');
    assert.equal(planForPriceId('price_pro_a'), 'pro', 'both periods map to the same plan');
    assert.equal(planForPriceId('price_team_m'), 'team');
  });

  test('an unknown price maps to nothing rather than guessing a tier', () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_m';
    assert.equal(planForPriceId('price_someone_created_in_the_dashboard'), null,
      'granting a guessed plan is worse than granting none');
  });
});

describe('account identification', () => {
  test('reads the account id we set at checkout', () => {
    assert.equal(accountIdFrom({ metadata: { kilnAccountId: 'acct_1' } }), 'acct_1');
  });

  test('absent metadata yields null, never undefined-as-a-string', () => {
    assert.equal(accountIdFrom({ metadata: {} }), null);
    assert.equal(accountIdFrom({}), null);
    assert.equal(accountIdFrom(null), null);
    assert.equal(accountIdFrom(undefined), null);
  });
});
