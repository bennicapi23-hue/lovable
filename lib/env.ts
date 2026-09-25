/**
 * Environment configuration, validated once and explained clearly.
 *
 * Upstream failed late and cryptically: a missing FIRECRAWL_API_KEY surfaced
 * as a thrown string in the middle of a scrape, and a half-configured Vercel
 * sandbox looked like a network error. Both are setup problems, and setup
 * problems should be reported at the door with the fix attached.
 *
 * Nothing here throws at import time. A self-hosted install should be able to
 * boot, show its own status page and tell the operator what is missing,
 * rather than crashing the server on the first request.
 */

export type SandboxProviderName = 'vercel' | 'e2b';

export interface EnvIssue {
  /** The variable, or the group of variables, at fault. */
  key: string;
  /** 'error' blocks the feature; 'warning' degrades it. */
  level: 'error' | 'warning';
  /** What is wrong, in one sentence. */
  message: string;
  /** What to do about it. */
  fix: string;
  /** Which product capability this affects. */
  feature: 'ai' | 'sandbox' | 'scraping' | 'fast-apply' | 'database' | 'auth';
}

export interface EnvReport {
  /** True when every capability required to build an app is configured. */
  ready: boolean;
  issues: EnvIssue[];
  /** Capability-level availability, for feature flags and status pages. */
  features: {
    ai: boolean;
    sandbox: boolean;
    scraping: boolean;
    fastApply: boolean;
    database: boolean;
    auth: boolean;
  };
  sandboxProvider: SandboxProviderName;
  /** Model providers with a usable key, in preference order. */
  aiProviders: string[];
}

function present(name: string): boolean {
  const value = process.env[name];
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Placeholders copied straight out of .env.example are not configuration.
  return !/^(your_|auto_generated_by|xxx|changeme|<)/i.test(trimmed);
}

/** Inspects the current environment. Cheap enough to call per request. */
export function inspectEnv(): EnvReport {
  const issues: EnvIssue[] = [];

  /* ---------------------------------------------------------------- AI -- */
  const gateway = present('AI_GATEWAY_API_KEY');
  const aiProviders = [
    gateway && 'gateway',
    present('ANTHROPIC_API_KEY') && 'anthropic',
    present('OPENAI_API_KEY') && 'openai',
    present('GEMINI_API_KEY') && 'google',
    present('GROQ_API_KEY') && 'groq',
  ].filter(Boolean) as string[];

  const ai = aiProviders.length > 0;
  if (!ai) {
    issues.push({
      key: 'AI_GATEWAY_API_KEY | ANTHROPIC_API_KEY | OPENAI_API_KEY | GEMINI_API_KEY | GROQ_API_KEY',
      level: 'error',
      feature: 'ai',
      message: 'No language model provider is configured, so nothing can be planned or generated.',
      fix: 'Set at least one provider key in .env.local. AI_GATEWAY_API_KEY covers all of them at once.',
    });
  }

  /* ----------------------------------------------------------- sandbox -- */
  const configured = (process.env.SANDBOX_PROVIDER || 'vercel').toLowerCase();
  const sandboxProvider: SandboxProviderName = configured === 'e2b' ? 'e2b' : 'vercel';

  if (configured !== 'vercel' && configured !== 'e2b') {
    issues.push({
      key: 'SANDBOX_PROVIDER',
      level: 'warning',
      feature: 'sandbox',
      message: `SANDBOX_PROVIDER is "${configured}", which is not a provider this build knows.`,
      fix: 'Set SANDBOX_PROVIDER to "vercel" or "e2b". Falling back to vercel.',
    });
  }

  let sandbox: boolean;
  if (sandboxProvider === 'e2b') {
    sandbox = present('E2B_API_KEY');
    if (!sandbox) {
      issues.push({
        key: 'E2B_API_KEY',
        level: 'error',
        feature: 'sandbox',
        message: 'SANDBOX_PROVIDER is e2b but E2B_API_KEY is not set, so generated apps cannot run.',
        fix: 'Add E2B_API_KEY from e2b.dev, or switch SANDBOX_PROVIDER to vercel.',
      });
    }
  } else {
    const oidc = present('VERCEL_OIDC_TOKEN');
    const pat =
      present('VERCEL_TOKEN') && present('VERCEL_TEAM_ID') && present('VERCEL_PROJECT_ID');
    sandbox = oidc || pat;

    if (!sandbox) {
      // Name the partial case specifically — a half-filled PAT trio is the
      // most common way to get this wrong.
      const partial =
        present('VERCEL_TOKEN') || present('VERCEL_TEAM_ID') || present('VERCEL_PROJECT_ID');
      issues.push({
        key: 'VERCEL_OIDC_TOKEN | VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID',
        level: 'error',
        feature: 'sandbox',
        message: partial
          ? 'Vercel sandbox credentials are incomplete, so generated apps cannot run.'
          : 'No Vercel sandbox credentials are set, so generated apps cannot run.',
        fix: 'Run `vercel link && vercel env pull` for VERCEL_OIDC_TOKEN, or set all three of VERCEL_TOKEN, VERCEL_TEAM_ID and VERCEL_PROJECT_ID.',
      });
    }
  }

  /* ---------------------------------------------------------- scraping -- */
  const scraping = present('FIRECRAWL_API_KEY');
  if (!scraping) {
    issues.push({
      key: 'FIRECRAWL_API_KEY',
      level: 'warning',
      feature: 'scraping',
      message: 'Firecrawl is not configured, so rebuilding an app from a URL is unavailable.',
      fix: 'Add FIRECRAWL_API_KEY from firecrawl.dev. Building from a description works without it.',
    });
  }

  /* -------------------------------------------------------- fast apply -- */
  const fastApply = present('MORPH_API_KEY');

  /* ---------------------------------------------------------- database -- */
  // A missing DATABASE_URL is fine: it falls back to a local file. A remote
  // URL without its token is not — that fails on the first query instead.
  const databaseUrl = process.env.DATABASE_URL?.trim() || 'file:./kiln.db';
  const remoteDb = databaseUrl.startsWith('libsql://') || databaseUrl.startsWith('https://');
  const database = !remoteDb || present('DATABASE_AUTH_TOKEN');

  if (!database) {
    issues.push({
      key: 'DATABASE_AUTH_TOKEN',
      level: 'error',
      feature: 'database',
      message: 'DATABASE_URL points at a remote database but no auth token is set.',
      fix: 'Add DATABASE_AUTH_TOKEN, or use a local file such as DATABASE_URL=file:./kiln.db.',
    });
  }

  /* -------------------------------------------------------------- auth -- */
  const auth = present('AUTH_SECRET');
  if (!auth) {
    issues.push({
      key: 'AUTH_SECRET',
      level: 'error',
      feature: 'auth',
      message: 'AUTH_SECRET is not set, so sessions cannot be signed and nobody can sign in.',
      fix: 'Generate one with `openssl rand -base64 32` and put it in .env.local.',
    });
  }

  const ready = ai && sandbox && database && auth;

  return {
    ready,
    issues,
    features: { ai, sandbox, scraping, fastApply, database, auth },
    sandboxProvider,
    aiProviders,
  };
}

/** Blocking issues only. Empty means the product can build an app. */
export function blockingIssues(): EnvIssue[] {
  return inspectEnv().issues.filter((i) => i.level === 'error');
}

/**
 * Formats the report for a terminal. Called by `pnpm check:env` so an
 * operator can verify a deployment without opening the app.
 */
export function formatEnvReport(report: EnvReport = inspectEnv()): string {
  const lines: string[] = [];
  lines.push(report.ready ? '✔ Kiln is configured and ready.' : '✖ Kiln is not ready to build.');
  lines.push('');
  lines.push(`  Sandbox provider : ${report.sandboxProvider}`);
  lines.push(`  Model providers  : ${report.aiProviders.join(', ') || 'none'}`);
  lines.push(`  Database         : ${report.features.database ? 'configured' : 'not configured'}`);
  lines.push(`  Authentication   : ${report.features.auth ? 'configured' : 'not configured'}`);
  lines.push(`  URL rebuild      : ${report.features.scraping ? 'available' : 'unavailable'}`);
  lines.push(`  Fast apply       : ${report.features.fastApply ? 'enabled' : 'disabled'}`);

  if (report.issues.length) {
    lines.push('');
    for (const issue of report.issues) {
      lines.push(`  ${issue.level === 'error' ? '✖' : '!'} ${issue.key}`);
      lines.push(`      ${issue.message}`);
      lines.push(`      → ${issue.fix}`);
    }
  }

  return lines.join('\n');
}
