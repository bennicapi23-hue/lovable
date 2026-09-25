import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { describeApiError } from '@/lib/api-error.ts';

/** Minimal Response stand-in with the bits the helper reads. */
function response(status, body, headers = {}) {
  const payload = body === undefined ? null : JSON.stringify(body);
  return {
    status,
    headers: { get: (n) => headers[n] ?? null },
    clone() {
      return {
        json: async () => {
          if (payload === null) throw new Error('not json');
          return JSON.parse(payload);
        },
      };
    },
  };
}

describe('describeApiError', () => {
  test('a quota refusal keeps the reason, the reset date and the upgrade path', async () => {
    const message = await describeApiError(
      response(402, {
        error: 'You have used all 10 builds on the Starter plan this month.',
        plan: 'free',
        resetsAt: '2026-11-01T00:00:00.000Z',
        upgrade: '/pricing',
      }),
    );
    assert.match(message, /all 10 builds/);
    assert.match(message, /November/);
    assert.match(message, /\/pricing/);
  });

  test('a rate limit tells the user how long to wait', async () => {
    const message = await describeApiError(
      response(429, { error: 'Too many generation requests.' }, { 'Retry-After': '42' }),
    );
    assert.match(message, /Too many generation requests/);
    assert.match(message, /42 seconds/);
  });

  test('one second is singular, because "1 seconds" looks broken', async () => {
    const message = await describeApiError(
      response(429, { error: 'Slow down.' }, { 'Retry-After': '1' }),
    );
    assert.match(message, /1 second\./);
  });

  test('an absent or nonsense Retry-After is simply omitted', async () => {
    for (const headers of [{}, { 'Retry-After': 'soon' }, { 'Retry-After': '-5' }]) {
      const message = await describeApiError(response(429, { error: 'Slow down.' }, headers));
      assert.equal(message, 'Slow down.');
    }
  });

  test('an auth failure is described as a deployment problem, not a user one', async () => {
    const message = await describeApiError(response(401, undefined));
    assert.match(message, /API key/);
  });

  test('a non-JSON body still produces something useful', async () => {
    const message = await describeApiError(response(500, undefined), 'Could not generate.');
    assert.match(message, /Could not generate/);
    assert.match(message, /500/);
  });

  test('the server message wins over the fallback when there is one', async () => {
    const message = await describeApiError(response(500, { error: 'Sandbox died.' }), 'Fallback');
    assert.equal(message, 'Sandbox died.');
  });

  test('a malformed resetsAt is dropped rather than rendered as Invalid Date', async () => {
    const message = await describeApiError(
      response(402, { error: 'Out of builds.', resetsAt: 'not-a-date' }),
    );
    assert.equal(message, 'Out of builds.');
  });
});
