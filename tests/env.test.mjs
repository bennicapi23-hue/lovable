import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { inspectEnv, blockingIssues, formatEnvReport } from '@/lib/env.ts';

const KEYS = [
  'AI_GATEWAY_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY',
  'GROQ_API_KEY', 'SANDBOX_PROVIDER', 'E2B_API_KEY', 'VERCEL_OIDC_TOKEN',
  'VERCEL_TOKEN', 'VERCEL_TEAM_ID', 'VERCEL_PROJECT_ID', 'FIRECRAWL_API_KEY',
  'MORPH_API_KEY',
];

let saved;

describe('environment inspection', () => {
  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    for (const k of KEYS) delete process.env[k];
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  test('an empty environment is not ready, and says so per capability', () => {
    const report = inspectEnv();
    assert.equal(report.ready, false);
    assert.equal(report.features.ai, false);
    assert.equal(report.features.sandbox, false);
    assert.ok(blockingIssues().length >= 2);
  });

  test('every issue carries a fix, because a diagnosis without one is noise', () => {
    for (const issue of inspectEnv().issues) {
      assert.ok(issue.fix && issue.fix.length > 10, `${issue.key} has no actionable fix`);
      assert.ok(['error', 'warning'].includes(issue.level));
    }
  });

  test('placeholder values copied from .env.example do not count as configured', () => {
    process.env.OPENAI_API_KEY = 'your_openai_api_key';
    process.env.VERCEL_OIDC_TOKEN = 'auto_generated_by_vercel_env_pull';
    const report = inspectEnv();
    assert.equal(report.features.ai, false, 'a placeholder key must not read as configured');
    assert.equal(report.features.sandbox, false);
  });

  test('one model key plus one sandbox credential is enough to be ready', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-real';
    process.env.VERCEL_OIDC_TOKEN = 'real-token';
    const report = inspectEnv();
    assert.equal(report.ready, true);
    assert.deepEqual(report.aiProviders, ['anthropic']);
  });

  test('a partially filled Vercel PAT trio is still a failure', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-real';
    process.env.VERCEL_TOKEN = 'tok';
    process.env.VERCEL_TEAM_ID = 'team';
    // VERCEL_PROJECT_ID deliberately missing
    const report = inspectEnv();
    assert.equal(report.features.sandbox, false);
    assert.match(report.issues.find((i) => i.feature === 'sandbox').message, /incomplete/);
  });

  test('the full PAT trio works', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-real';
    process.env.VERCEL_TOKEN = 'tok';
    process.env.VERCEL_TEAM_ID = 'team';
    process.env.VERCEL_PROJECT_ID = 'prj';
    assert.equal(inspectEnv().ready, true);
  });

  test('e2b is judged on its own key, not on the Vercel ones', () => {
    process.env.SANDBOX_PROVIDER = 'e2b';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-real';
    process.env.VERCEL_OIDC_TOKEN = 'real-token';
    assert.equal(inspectEnv().features.sandbox, false);

    process.env.E2B_API_KEY = 'e2b-real';
    assert.equal(inspectEnv().features.sandbox, true);
  });

  test('an unknown sandbox provider warns and falls back rather than breaking', () => {
    process.env.SANDBOX_PROVIDER = 'docker';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-real';
    process.env.VERCEL_OIDC_TOKEN = 'real-token';
    const report = inspectEnv();
    assert.equal(report.sandboxProvider, 'vercel');
    assert.ok(report.issues.some((i) => i.key === 'SANDBOX_PROVIDER' && i.level === 'warning'));
  });

  test('a missing Firecrawl key degrades rather than blocks', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-real';
    process.env.VERCEL_OIDC_TOKEN = 'real-token';
    const report = inspectEnv();
    assert.equal(report.ready, true, 'building from a description must not need Firecrawl');
    assert.equal(report.features.scraping, false);
    assert.equal(report.issues.find((i) => i.feature === 'scraping').level, 'warning');
  });

  test('the formatted report is human-readable and leaks no secrets', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-SUPERSECRET';
    process.env.VERCEL_OIDC_TOKEN = 'tok-SUPERSECRET';
    const text = formatEnvReport();
    assert.ok(text.includes('ready'));
    assert.ok(!text.includes('SUPERSECRET'), 'the report must never echo key material');
  });
});
