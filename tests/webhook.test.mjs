import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import Stripe from 'stripe';

/**
 * Webhook signature verification, against Stripe's own implementation.
 *
 * This endpoint is the only thing that moves an account between plans, so a
 * forged request here is a free upgrade for anyone who finds the URL. These
 * tests use the real verifier rather than a stub: a hand-rolled check that
 * agrees with a hand-rolled test proves nothing.
 */

const SECRET = 'whsec_test_secret_value';
const stripe = new Stripe('sk_test_placeholder', { apiVersion: '2026-08-26.dahlia' });

function sign(payload, secret = SECRET, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

const event = JSON.stringify({
  id: 'evt_test',
  object: 'event',
  type: 'customer.subscription.updated',
  data: { object: { id: 'sub_test', status: 'active', metadata: { kilnAccountId: 'acct_1' } } },
});

describe('webhook signatures', () => {
  test('a correctly signed payload verifies', () => {
    const parsed = stripe.webhooks.constructEvent(event, sign(event), SECRET);
    assert.equal(parsed.type, 'customer.subscription.updated');
  });

  test('an unsigned request is rejected', () => {
    assert.throws(() => stripe.webhooks.constructEvent(event, '', SECRET));
  });

  test('a signature from the wrong secret is rejected', () => {
    const forged = sign(event, 'whsec_attacker_guess');
    assert.throws(() => stripe.webhooks.constructEvent(event, forged, SECRET));
  });

  test('a payload altered after signing is rejected', () => {
    const signature = sign(event);
    const tampered = event.replace('acct_1', 'acct_attacker');
    assert.throws(
      () => stripe.webhooks.constructEvent(tampered, signature, SECRET),
      /signature/i,
      'swapping the account id must invalidate the signature',
    );
  });

  test('an old signature is rejected, so captured requests cannot be replayed', () => {
    const stale = sign(event, SECRET, Math.floor(Date.now() / 1000) - 3600);
    assert.throws(() => stripe.webhooks.constructEvent(event, stale, SECRET), /timestamp/i);
  });

  test('re-encoding the body breaks verification', () => {
    // Why the route reads request.text() and never request.json(): the
    // signature covers the exact bytes Stripe sent.
    const signature = sign(event);
    const reencoded = JSON.stringify(JSON.parse(event).data);
    assert.throws(() => stripe.webhooks.constructEvent(reencoded, signature, SECRET));
  });
});

describe('webhook route contract', () => {
  test('the route reads the raw body and pins the Node runtime', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(
      new URL('../app/api/billing/webhook/route.ts', import.meta.url), 'utf8');

    assert.match(source, /await request\.text\(\)/,
      'the raw body is required for signature verification');
    assert.ok(!/await request\.json\(\)/.test(source),
      'parsing the body before verifying it would break the signature');
    assert.match(source, /export const runtime = 'nodejs'/,
      'the edge runtime cannot verify Stripe signatures');
  });

  test('a missing signing secret refuses rather than trusting the caller', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(
      new URL('../app/api/billing/webhook/route.ts', import.meta.url), 'utf8');
    assert.match(source, /STRIPE_WEBHOOK_SECRET[\s\S]{0,400}501/,
      'without the secret every caller is unauthenticated');
  });

  test('a handler failure returns 500 so Stripe retries', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(
      new URL('../app/api/billing/webhook/route.ts', import.meta.url), 'utf8');
    assert.match(source, /Handler failed[\s\S]{0,120}500/,
      'a 200 on failure silently drops the event and the customer pays for nothing');
  });
});
