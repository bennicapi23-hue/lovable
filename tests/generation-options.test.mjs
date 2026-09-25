import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appConfig } from '@/config/app.config.ts';

/**
 * The generation route builds its provider options as an untyped object, so
 * a misspelled option is accepted by TypeScript and then silently dropped by
 * the SDK. That is exactly what happened: the route passed `maxTokens`, the
 * AI SDK v5 only reads `maxOutputTokens`, and every generation ran against
 * the provider default instead of the configured ceiling — long enough to
 * truncate a full build mid-file.
 *
 * These assertions are deliberately made against the source text, because the
 * bug is invisible at the type level and only shows up in the request body.
 */
const ROUTE = readFileSync(
  new URL('../app/api/generate-ai-code-stream/route.ts', import.meta.url),
  'utf8',
);

describe('generation request options', () => {
  test('the token ceiling uses the option name the SDK actually reads', () => {
    assert.match(
      ROUTE,
      /maxOutputTokens:\s*isCreate\s*\?\s*appConfig\.ai\.createMaxTokens\s*:\s*appConfig\.ai\.maxTokens/,
      'streamText options must set maxOutputTokens, not maxTokens',
    );
  });

  test('no bare maxTokens option survives in the route', () => {
    const bare = ROUTE.match(/(?<!maxOutput)\bmaxTokens:/g) ?? [];
    assert.equal(bare.length, 0, 'maxTokens is ignored by the SDK; use maxOutputTokens');
  });

  test('a fresh build gets a far higher ceiling than an edit', () => {
    assert.ok(
      appConfig.ai.createMaxTokens > appConfig.ai.maxTokens * 2,
      'a full build writes every file at once and needs real headroom',
    );
  });

  test('create mode is mutually exclusive with edit mode', () => {
    assert.match(
      ROUTE,
      /const isCreate = mode === 'create' && !isEdit/,
      'an edit must always win, so an existing app is never flattened',
    );
  });

  test('the greenfield rules are appended after the base prompt, not instead of it', () => {
    const basePrompt = ROUTE.indexOf('let systemPrompt =');
    const greenfield = ROUTE.indexOf('systemPrompt += GREENFIELD_SYSTEM_RULES');
    assert.ok(basePrompt > -1 && greenfield > basePrompt,
      'create mode must extend the base prompt so the <file> output format survives');
  });
});
