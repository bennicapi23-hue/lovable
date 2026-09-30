import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createLogger } from '@/lib/observability/logger.ts';
import {
  priceBuild, modelRates, sandboxRatePerMinute, formatCost, planMargin,
} from '@/lib/observability/cost.ts';
import { PLANS } from '@/config/plans.config.ts';

/** Captures what the logger writes, so assertions are on real output. */
function capture(fn) {
  const lines = [];
  const original = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  for (const level of Object.keys(original)) {
    console[level] = (...args) => lines.push(args.join(' '));
  }
  try { fn(); } finally { Object.assign(console, original); }
  return lines;
}

const ENV = ['NODE_ENV', 'LOG_LEVEL', 'KILN_MODEL_RATES', 'KILN_SANDBOX_RATE'];
let saved;

describe('structured logging', () => {
  beforeEach(() => {
    saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });

  test('production output is one JSON object per line', () => {
    process.env.NODE_ENV = 'production';
    const [line] = capture(() => createLogger('test').info('built', { accountId: 'acct_1' }));
    const parsed = JSON.parse(line);
    assert.equal(parsed.level, 'info');
    assert.equal(parsed.scope, 'test');
    assert.equal(parsed.message, 'built');
    assert.equal(parsed.accountId, 'acct_1');
    assert.ok(Date.parse(parsed.time));
  });

  test('anything that looks like a credential is redacted', () => {
    process.env.NODE_ENV = 'production';
    const [line] = capture(() =>
      createLogger('test').info('call', {
        apiKey: 'sk-live-REALSECRET',
        nested: { authorization: 'Bearer REALSECRET', model: 'gpt-5' },
        signature: 'v1=REALSECRET',
      }));
    assert.ok(!line.includes('REALSECRET'), 'logs travel further than the data in them');
    assert.ok(line.includes('[redacted]'));
    assert.ok(line.includes('gpt-5'), 'non-secret fields must survive');
  });

  test('errors carry name and message, not just a stringified object', () => {
    process.env.NODE_ENV = 'production';
    const [line] = capture(() =>
      createLogger('test').error('failed', new TypeError('bad input'), { buildId: 'b1' }));
    const parsed = JSON.parse(line);
    assert.equal(parsed.errorName, 'TypeError');
    assert.equal(parsed.errorMessage, 'bad input');
    assert.equal(parsed.buildId, 'b1');
  });

  test('level filtering suppresses what is below the threshold', () => {
    process.env.NODE_ENV = 'production';
    process.env.LOG_LEVEL = 'warn';
    const lines = capture(() => {
      const log = createLogger('test');
      log.debug('noise'); log.info('noise'); log.warn('kept'); log.error('kept');
    });
    assert.equal(lines.length, 2);
  });

  test('a child logger repeats its bound fields', () => {
    process.env.NODE_ENV = 'production';
    const log = createLogger('test').with({ buildId: 'b1', accountId: 'a1' });
    const lines = capture(() => { log.info('one'); log.info('two'); });
    for (const line of lines) {
      const parsed = JSON.parse(line);
      assert.equal(parsed.buildId, 'b1');
      assert.equal(parsed.accountId, 'a1');
    }
  });
});

describe('build cost', () => {
  beforeEach(() => {
    saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
    delete process.env.KILN_MODEL_RATES;
    delete process.env.KILN_SANDBOX_RATE;
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });

  test('an unpriced model reads as unknown, never as free', () => {
    const cost = priceBuild({ model: 'openai/gpt-5', tokens: { inputTokens: 1000, outputTokens: 5000 } });
    assert.equal(cost.modelCost, null);
    assert.equal(cost.total, null, 'a missing rate must not quietly understate cost');
    assert.equal(formatCost(cost.total), 'unknown');
  });

  test('token counts are recorded even with no rate configured', () => {
    const cost = priceBuild({ model: 'x', tokens: { inputTokens: 1234, outputTokens: 5678 } });
    assert.equal(cost.tokens.inputTokens, 1234);
    assert.equal(cost.tokens.outputTokens, 5678);
  });

  test('a configured rate produces a real number', () => {
    process.env.KILN_MODEL_RATES = 'openai/gpt-5:1.00:8.00';
    const cost = priceBuild({
      model: 'openai/gpt-5',
      tokens: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
    });
    assert.equal(cost.modelCost, 9);
  });

  test('cached input is billed at its own lower rate', () => {
    process.env.KILN_MODEL_RATES = 'm:10.00:20.00:1.00';
    const cost = priceBuild({
      model: 'm',
      tokens: { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 900_000 },
    });
    // 100k fresh at 10 + 900k cached at 1 = 1.00 + 0.90
    assert.equal(cost.modelCost, 1.9);
  });

  test('sandbox time is priced separately and completes the total', () => {
    process.env.KILN_MODEL_RATES = 'm:1.00:1.00';
    process.env.KILN_SANDBOX_RATE = '0.06';
    const cost = priceBuild({
      model: 'm',
      tokens: { inputTokens: 1_000_000, outputTokens: 0 },
      sandboxSeconds: 120,
    });
    assert.equal(cost.sandboxCost, 0.12);
    assert.equal(cost.total, 1.12);
  });

  test('a malformed rate string is ignored rather than producing NaN', () => {
    process.env.KILN_MODEL_RATES = 'broken,m:notanumber:5,good:1:2';
    const rates = modelRates();
    assert.ok(!('broken' in rates));
    assert.ok(!('m' in rates));
    assert.deepEqual(rates.good, { input: 1, output: 2 });
  });

  test('a negative or nonsense sandbox rate is refused', () => {
    process.env.KILN_SANDBOX_RATE = '-1';
    assert.equal(sandboxRatePerMinute(), null);
    process.env.KILN_SANDBOX_RATE = 'free';
    assert.equal(sandboxRatePerMinute(), null);
  });
});

describe('plan margin', () => {
  test('the Pro plan is profitable at a plausible cost per build', () => {
    const pro = PLANS.find((p) => p.id === 'pro');
    const result = planMargin({
      monthlyPrice: pro.monthly,
      includedBuilds: pro.limits.buildsPerMonth,
      costPerBuild: 0.08,
    });
    assert.ok(result.margin > 0,
      `Pro loses money at 8c a build: €${result.cost} cost against €${result.revenue}`);
  });

  test('the check fires when a build costs too much', () => {
    const pro = PLANS.find((p) => p.id === 'pro');
    const result = planMargin({
      monthlyPrice: pro.monthly,
      includedBuilds: pro.limits.buildsPerMonth,
      costPerBuild: 0.50,
    });
    assert.ok(result.margin < 0,
      'at 50c a build Pro must read as loss-making — this is the check nobody runs in time');
  });

  test('reports the break-even cost per build for every paid plan', () => {
    for (const plan of PLANS.filter((p) => p.monthly && p.monthly > 0)) {
      const breakEven = plan.monthly / plan.limits.buildsPerMonth;
      assert.ok(breakEven > 0);
      // Not an assertion so much as a record: these are the numbers the
      // first real builds must come in under.
      console.log(`      ${plan.name}: break-even at €${breakEven.toFixed(3)} per build`);
    }
  });
});
