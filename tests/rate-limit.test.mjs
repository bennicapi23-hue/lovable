import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit, clientKey, __resetRateLimits } from '@/lib/security/rate-limit.ts';

/** Minimal stand-in for NextRequest: the limiter only reads headers. */
function request(headers = {}) {
  return { headers: { get: (name) => headers[name.toLowerCase()] ?? null } };
}

describe('rate limiting', () => {
  beforeEach(() => __resetRateLimits());

  test('allows requests up to the limit, then refuses', async () => {
    const req = request({ 'x-forwarded-for': '1.2.3.4' });
    const opts = { bucket: 'test', limit: 3, windowMs: 60_000 };

    for (let i = 0; i < 3; i += 1) {
      assert.equal((await rateLimit(req, opts)).ok, true, `request ${i + 1} should pass`);
    }
    const refused = await rateLimit(req, opts);
    assert.equal(refused.ok, false);
    assert.equal(refused.remaining, 0);
    assert.ok(refused.headers['Retry-After'], 'a refusal must say when to retry');
  });

  test('reports remaining allowance accurately', async () => {
    const req = request({ 'x-forwarded-for': '1.2.3.4' });
    const opts = { bucket: 'test', limit: 5, windowMs: 60_000 };
    const first = await rateLimit(req, opts);
    assert.equal(first.remaining, 4);
    assert.equal(first.headers['X-RateLimit-Limit'], '5');
  });

  test('separates clients', async () => {
    const opts = { bucket: 'test', limit: 1, windowMs: 60_000 };
    await rateLimit(request({ 'x-forwarded-for': '1.1.1.1' }), opts);
    const other = await rateLimit(request({ 'x-forwarded-for': '2.2.2.2' }), opts);
    assert.equal(other.ok, true, 'one client must not exhaust another client’s budget');
  });

  test('separates buckets, so endpoints do not share a budget', async () => {
    const req = request({ 'x-forwarded-for': '1.2.3.4' });
    await rateLimit(req, { bucket: 'a', limit: 1, windowMs: 60_000 });
    const b = await rateLimit(req, { bucket: 'b', limit: 1, windowMs: 60_000 });
    assert.equal(b.ok, true);
  });

  test('the window expires', async () => {
    const req = request({ 'x-forwarded-for': '1.2.3.4' });
    const opts = { bucket: 'test', limit: 1, windowMs: 1 };
    await rateLimit(req, opts);
    await new Promise((r) => setTimeout(r, 12));
    assert.equal((await rateLimit(req, opts)).ok, true, 'allowance should return after the window');
  });

  test('declares its own scope, so nobody assumes it is cluster-wide', async () => {
    const result = await rateLimit(request({ 'x-forwarded-for': '1.2.3.4' }), {
      bucket: 'test',
      limit: 1,
      windowMs: 60_000,
    });
    assert.equal(result.headers['X-RateLimit-Scope'], 'instance');
  });

  test('clientKey prefers the forwarded address and takes the first hop', () => {
    assert.equal(clientKey(request({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' })), '9.9.9.9');
    assert.equal(clientKey(request({ 'x-real-ip': '8.8.8.8' })), '8.8.8.8');
    assert.equal(clientKey(request({})), 'local');
  });
});
