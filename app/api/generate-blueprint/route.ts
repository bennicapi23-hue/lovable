import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { getProviderForModel, resolveUsableModel } from '@/lib/ai/provider-manager';
import { appConfig } from '@/config/app.config';
import {
  blueprintSchema,
  buildPlannerPrompt,
  normaliseBlueprint,
} from '@/lib/app-builder/blueprint';
import { getArchetype, inferArchetype } from '@/lib/app-builder/archetypes';
import { rateLimit } from '@/lib/security/rate-limit';
import { resolveAccount } from '@/lib/billing/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_PROMPT_LENGTH = appConfig.appBuilder.maxPromptLength;

/**
 * POST /api/generate-blueprint
 *
 * Plans an application before any code is generated. Returns a structured
 * blueprint the user can review, edit and approve, which then drives the
 * build. See lib/app-builder/blueprint.ts for why the planning pass exists.
 */
export async function POST(request: NextRequest) {
  const limit = await rateLimit(request, { bucket: 'blueprint', limit: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'Too many planning requests. Try again shortly.' },
      { status: 429, headers: limit.headers },
    );
  }

  // Planning costs model tokens, so it is behind the same door as building.
  // It does not spend build allowance: a plan the user rejects should not be
  // charged for, and making planning free encourages correcting it.
  const account = await resolveAccount(request);
  if (!account) {
    return NextResponse.json(
      { success: false, error: 'Sign in to plan an app.', signIn: '/sign-in' },
      { status: 401, headers: limit.headers },
    );
  }

  let body: { prompt?: unknown; model?: unknown; archetype?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    return NextResponse.json(
      { success: false, error: 'Describe the app you want to build.' },
      { status: 400 },
    );
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { success: false, error: `Description is too long (max ${MAX_PROMPT_LENGTH} characters).` },
      { status: 400 },
    );
  }

  // Fall back to a model this deployment holds a key for, rather than failing
  // on the configured default for a provider the operator never set up.
  const { model, substituted, requested } = resolveUsableModel(
    typeof body.model === 'string' ? body.model : undefined,
  );
  if (substituted) {
    console.log(`[generate-blueprint] ${requested} is not configured; using ${model}`);
  }

  // An explicitly chosen archetype wins; otherwise infer one from the text.
  const archetype =
    getArchetype(typeof body.archetype === 'string' ? body.archetype : undefined) ??
    inferArchetype(prompt);

  try {
    const { client, actualModel } = getProviderForModel(model);

    // Reasoning models reject an explicit temperature, so omit it for them
    // rather than failing the whole planning call over a sampling hint.
    const isReasoningModel = model.startsWith('openai/gpt-5');

    const { object } = await generateObject({
      model: client(actualModel),
      schema: blueprintSchema,
      prompt: buildPlannerPrompt(prompt, archetype),
      ...(isReasoningModel ? {} : { temperature: appConfig.ai.blueprintTemperature }),
      maxRetries: 2,
    });

    const blueprint = normaliseBlueprint(object, {
      archetypeId: archetype?.id,
      fallbackName: prompt.slice(0, 40),
    });

    return NextResponse.json(
      {
        success: true,
        blueprint,
        archetype: archetype?.id ?? blueprint.archetype,
        model,
        // Surfaced so the UI can say which model actually ran.
        ...(substituted ? { substitutedFrom: requested } : {}),
      },
      { headers: limit.headers },
    );
  } catch (error) {
    console.error('[generate-blueprint] planning failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    // A missing key is a setup problem, not a server fault — say so plainly.
    if (/api[_ ]?key|unauthorized|401/i.test(message)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'The configured AI provider rejected the request. Check the API key for this model in your environment.',
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { success: false, error: `Could not plan the app: ${message}` },
      { status: 500 },
    );
  }
}
