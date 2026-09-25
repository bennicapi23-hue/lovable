#!/usr/bin/env node
/**
 * Prints whether this environment can actually run Kiln, and what to fix if
 * not. Run it after editing .env.local, or in a deployment pipeline as a
 * gate before the app is promoted.
 *
 * Usage: pnpm check:env
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);

// Load .env.local the way Next.js does, so the check matches runtime.
for (const file of ['.env.local', '.env']) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) {
    require('dotenv').config({ path, override: false });
  }
}

// lib/env.ts is TypeScript, and this script must run without a build step,
// so the checks are mirrored here against the same variable names.
const has = (name) => {
  const v = process.env[name];
  return Boolean(v && v.trim() && !/^(your_|auto_generated_by|xxx|changeme|<)/i.test(v.trim()));
};

const aiProviders = [
  has('AI_GATEWAY_API_KEY') && 'gateway',
  has('ANTHROPIC_API_KEY') && 'anthropic',
  has('OPENAI_API_KEY') && 'openai',
  has('GEMINI_API_KEY') && 'google',
  has('GROQ_API_KEY') && 'groq',
].filter(Boolean);

const provider = (process.env.SANDBOX_PROVIDER || 'vercel').toLowerCase();
const sandboxOk =
  provider === 'e2b'
    ? has('E2B_API_KEY')
    : has('VERCEL_OIDC_TOKEN') ||
      (has('VERCEL_TOKEN') && has('VERCEL_TEAM_ID') && has('VERCEL_PROJECT_ID'));

const issues = [];
if (aiProviders.length === 0) {
  issues.push([
    'No language model provider configured',
    'Set AI_GATEWAY_API_KEY, or one of ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY / GROQ_API_KEY in .env.local',
  ]);
}
if (!sandboxOk) {
  issues.push(
    provider === 'e2b'
      ? ['E2B sandbox is selected but E2B_API_KEY is missing', 'Add E2B_API_KEY from e2b.dev']
      : [
          'Vercel sandbox credentials are missing or incomplete',
          'Run `vercel link && vercel env pull`, or set VERCEL_TOKEN, VERCEL_TEAM_ID and VERCEL_PROJECT_ID together',
        ],
  );
}
if (!has('FIRECRAWL_API_KEY')) {
  issues.push([
    'Firecrawl is not configured — rebuilding from a URL will be unavailable',
    'Add FIRECRAWL_API_KEY from firecrawl.dev (optional: building from a description works without it)',
  ]);
}

const blocking = aiProviders.length === 0 || !sandboxOk;

console.log(blocking ? '\n✖ Kiln is not ready to build.\n' : '\n✔ Kiln is configured and ready.\n');
console.log(`  Sandbox provider : ${provider}`);
console.log(`  Model providers  : ${aiProviders.join(', ') || 'none'}`);
console.log(`  URL rebuild      : ${has('FIRECRAWL_API_KEY') ? 'available' : 'unavailable'}`);
console.log(`  Fast apply       : ${has('MORPH_API_KEY') ? 'enabled' : 'disabled'}`);

if (issues.length) {
  console.log('');
  for (const [problem, fix] of issues) {
    console.log(`  - ${problem}`);
    console.log(`    → ${fix}`);
  }
}
console.log('');

process.exit(blocking ? 1 : 0);
