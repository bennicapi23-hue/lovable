import { appConfig } from '@/config/app.config';

/**
 * What a build actually costs.
 *
 * Without this number the pricing in config/plans.config.ts is a guess:
 * 29 €/month for 200 builds only works if a build costs well under 10 cents.
 * Recording tokens and sandbox minutes per build is what turns that from an
 * assumption into a measurement.
 *
 * Rates are configuration because they change often and differ per account.
 * A missing rate yields a null cost rather than a wrong one — an unpriced
 * model should read as "unknown", never as "free".
 */

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  /** Cached input, billed lower by providers that support it. */
  cachedInputTokens?: number;
}

export interface BuildCost {
  model: string;
  tokens: TokenUsage;
  /** EUR, or null when this model has no configured rate. */
  modelCost: number | null;
  sandboxSeconds: number;
  sandboxCost: number | null;
  total: number | null;
}

/** Rate in EUR per million tokens. */
interface ModelRate {
  input: number;
  output: number;
  cachedInput?: number;
}

/**
 * Per-million-token rates, from KILN_MODEL_RATES.
 *
 * Shape: `model:input:output[:cachedInput],model:...`
 * Example: `openai/gpt-5:1.10:8.80,anthropic/claude-sonnet-4:2.70:13.50`
 *
 * Deliberately not hardcoded: provider prices move, and a stale constant in
 * the source would silently misreport margin for months.
 */
export function modelRates(): Record<string, ModelRate> {
  const raw = process.env.KILN_MODEL_RATES?.trim();
  if (!raw) return {};

  const rates: Record<string, ModelRate> = {};
  for (const entry of raw.split(',')) {
    const parts = entry.trim().split(':');
    if (parts.length < 3) continue;

    const [model, input, output, cached] = parts;
    const rate: ModelRate = { input: Number(input), output: Number(output) };
    if (cached !== undefined) rate.cachedInput = Number(cached);

    if (!model || !Number.isFinite(rate.input) || !Number.isFinite(rate.output)) continue;
    rates[model.trim()] = rate;
  }
  return rates;
}

/** EUR per sandbox-minute, from KILN_SANDBOX_RATE. */
export function sandboxRatePerMinute(): number | null {
  const raw = process.env.KILN_SANDBOX_RATE?.trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Costs one build. Returns nulls where a rate is missing rather than zeros. */
export function priceBuild(input: {
  model: string;
  tokens: TokenUsage;
  sandboxSeconds?: number;
}): BuildCost {
  const rate = modelRates()[input.model];
  const sandboxSeconds = Math.max(0, input.sandboxSeconds ?? 0);

  let modelCost: number | null = null;
  if (rate) {
    const cached = input.tokens.cachedInputTokens ?? 0;
    const freshInput = Math.max(0, input.tokens.inputTokens - cached);

    modelCost =
      (freshInput / 1_000_000) * rate.input +
      (cached / 1_000_000) * (rate.cachedInput ?? rate.input) +
      (input.tokens.outputTokens / 1_000_000) * rate.output;
  }

  const perMinute = sandboxRatePerMinute();
  const sandboxCost = perMinute === null ? null : (sandboxSeconds / 60) * perMinute;

  // Any unknown component makes the total unknown. Treating a missing rate as
  // zero would quietly understate cost, which is the failure that matters.
  const total =
    modelCost === null || sandboxCost === null
      ? null
      : round(modelCost + sandboxCost);

  return {
    model: input.model,
    tokens: input.tokens,
    modelCost: modelCost === null ? null : round(modelCost),
    sandboxSeconds,
    sandboxCost: sandboxCost === null ? null : round(sandboxCost),
    total,
  };
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/** Formats a cost for a log line or an operator dashboard. */
export function formatCost(cost: number | null): string {
  if (cost === null) return 'unknown';
  if (cost < 0.01) return `€${cost.toFixed(4)}`;
  return `€${cost.toFixed(2)}`;
}

/**
 * Whether a plan's price covers the cost of the builds it includes.
 *
 * The check nobody runs until margin is already negative. Exposed so it can
 * be asserted in a test and printed by an operator script.
 */
export function planMargin(input: {
  monthlyPrice: number;
  includedBuilds: number;
  costPerBuild: number;
}): { revenue: number; cost: number; margin: number; marginPct: number } {
  const cost = input.includedBuilds * input.costPerBuild;
  const margin = input.monthlyPrice - cost;
  return {
    revenue: input.monthlyPrice,
    cost: round(cost),
    margin: round(margin),
    marginPct: input.monthlyPrice > 0 ? Math.round((margin / input.monthlyPrice) * 100) : 0,
  };
}

export const COST_CONFIG_HINT =
  'Set KILN_MODEL_RATES and KILN_SANDBOX_RATE to see real build costs. ' +
  `Current default model: ${appConfig.ai.defaultModel}`;
