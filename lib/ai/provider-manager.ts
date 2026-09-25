import { appConfig } from '@/config/app.config';
import { createGroq } from '@ai-sdk/groq';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

type ProviderName = 'openai' | 'anthropic' | 'groq' | 'google';

// Client function type returned by @ai-sdk providers
export type ProviderClient =
  | ReturnType<typeof createOpenAI>
  | ReturnType<typeof createAnthropic>
  | ReturnType<typeof createGroq>
  | ReturnType<typeof createGoogleGenerativeAI>;

export interface ProviderResolution {
  client: ProviderClient;
  actualModel: string;
}

const aiGatewayApiKey = process.env.AI_GATEWAY_API_KEY;
const aiGatewayBaseURL = 'https://ai-gateway.vercel.sh/v1';
const isUsingAIGateway = !!aiGatewayApiKey;

// Cache provider clients by a stable key to avoid recreating
const clientCache = new Map<string, ProviderClient>();

function getEnvDefaults(provider: ProviderName): { apiKey?: string; baseURL?: string } {
  if (isUsingAIGateway) {
    return { apiKey: aiGatewayApiKey, baseURL: aiGatewayBaseURL };
  }

  switch (provider) {
    case 'openai':
      return { apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL };
    case 'anthropic':
      // Default Anthropic base URL mirrors existing routes
      return { apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1' };
    case 'groq':
      return { apiKey: process.env.GROQ_API_KEY, baseURL: process.env.GROQ_BASE_URL };
    case 'google':
      return { apiKey: process.env.GEMINI_API_KEY, baseURL: process.env.GEMINI_BASE_URL };
    default:
      return {};
  }
}

function getOrCreateClient(provider: ProviderName, apiKey?: string, baseURL?: string): ProviderClient {
  const effective = isUsingAIGateway
    ? { apiKey: aiGatewayApiKey, baseURL: aiGatewayBaseURL }
    : { apiKey, baseURL };

  const cacheKey = `${provider}:${effective.apiKey || ''}:${effective.baseURL || ''}`;
  const cached = clientCache.get(cacheKey);
  if (cached) return cached;

  let client: ProviderClient;
  switch (provider) {
    case 'openai':
      client = createOpenAI({ apiKey: effective.apiKey || getEnvDefaults('openai').apiKey, baseURL: effective.baseURL ?? getEnvDefaults('openai').baseURL });
      break;
    case 'anthropic':
      client = createAnthropic({ apiKey: effective.apiKey || getEnvDefaults('anthropic').apiKey, baseURL: effective.baseURL ?? getEnvDefaults('anthropic').baseURL });
      break;
    case 'groq':
      client = createGroq({ apiKey: effective.apiKey || getEnvDefaults('groq').apiKey, baseURL: effective.baseURL ?? getEnvDefaults('groq').baseURL });
      break;
    case 'google':
      client = createGoogleGenerativeAI({ apiKey: effective.apiKey || getEnvDefaults('google').apiKey, baseURL: effective.baseURL ?? getEnvDefaults('google').baseURL });
      break;
    default:
      client = createGroq({ apiKey: effective.apiKey || getEnvDefaults('groq').apiKey, baseURL: effective.baseURL ?? getEnvDefaults('groq').baseURL });
  }

  clientCache.set(cacheKey, client);
  return client;
}

/** Which provider a model id routes to. */
export function providerForModelId(modelId: string): ProviderName {
  const configured = appConfig.ai.modelApiConfig?.[modelId as keyof typeof appConfig.ai.modelApiConfig];
  if (configured) return (configured as { provider: ProviderName }).provider;
  if (modelId === 'moonshotai/kimi-k2-instruct-0905') return 'groq';
  if (modelId.startsWith('anthropic/')) return 'anthropic';
  if (modelId.startsWith('openai/')) return 'openai';
  if (modelId.startsWith('google/')) return 'google';
  return 'groq';
}

/** True when this deployment holds a usable key for that provider. */
export function isProviderConfigured(provider: ProviderName): boolean {
  if (isUsingAIGateway) return true;
  const key = getEnvDefaults(provider).apiKey?.trim();
  // Placeholders copied out of .env.example are not configuration.
  return Boolean(key && !/^(your_|xxx|changeme|<)/i.test(key));
}

/**
 * Resolves a model the deployment can actually call.
 *
 * The configured default is a preference, not a guarantee: an operator who
 * sets only OPENAI_API_KEY would otherwise see every request fail with a
 * provider error for a model they never chose. Falling back to an available
 * model keeps the product usable, and the caller is told when it happened so
 * the UI can say which model really ran.
 */
export function resolveUsableModel(requested?: string): {
  model: string;
  substituted: boolean;
  requested?: string;
} {
  const wanted = requested?.trim() || appConfig.ai.defaultModel;

  if (isProviderConfigured(providerForModelId(wanted))) {
    return { model: wanted, substituted: false };
  }

  const fallback = appConfig.ai.availableModels.find((candidate) =>
    isProviderConfigured(providerForModelId(candidate)),
  );

  // Nothing is configured. Hand back what was asked for so the caller fails
  // with the provider's own error rather than a confusing substitution.
  if (!fallback) return { model: wanted, substituted: false };

  return { model: fallback, substituted: fallback !== wanted, requested: wanted };
}

export function getProviderForModel(modelId: string): ProviderResolution {
  // 1) Check explicit model configuration in app config (custom models)
  const configured = appConfig.ai.modelApiConfig?.[modelId as keyof typeof appConfig.ai.modelApiConfig];
  if (configured) {
    const { provider, apiKey, baseURL, model } = configured as { provider: ProviderName; apiKey?: string; baseURL?: string; model: string };
    const client = getOrCreateClient(provider, apiKey, baseURL);
    return { client, actualModel: model };
  }

  // 2) Fallback logic based on prefixes and special cases
  const isAnthropic = modelId.startsWith('anthropic/');
  const isOpenAI = modelId.startsWith('openai/');
  const isGoogle = modelId.startsWith('google/');
  const isKimiGroq = modelId === 'moonshotai/kimi-k2-instruct-0905';

  if (isKimiGroq) {
    const client = getOrCreateClient('groq');
    return { client, actualModel: 'moonshotai/kimi-k2-instruct-0905' };
  }

  if (isAnthropic) {
    const client = getOrCreateClient('anthropic');
    return { client, actualModel: modelId.replace('anthropic/', '') };
  }

  if (isOpenAI) {
    const client = getOrCreateClient('openai');
    return { client, actualModel: modelId.replace('openai/', '') };
  }

  if (isGoogle) {
    const client = getOrCreateClient('google');
    return { client, actualModel: modelId.replace('google/', '') };
  }

  // Default: use Groq with modelId as-is
  const client = getOrCreateClient('groq');
  return { client, actualModel: modelId };
}

export default getProviderForModel;



