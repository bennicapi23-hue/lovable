/**
 * Module resolution hook for the test runner.
 *
 * Two things the TypeScript sources rely on, which Node's ESM resolver does
 * not do on its own:
 *
 *   1. The "@/..." path alias that tsconfig defines and Next.js understands.
 *   2. Extensionless relative imports ("./archetypes"), which bundlers
 *      resolve and Node does not.
 *
 * Handling both here means the tests exercise the real modules rather than
 * copies kept in sync by hand.
 *
 * Registered via --import=./tests/register-alias.mjs.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSIONS = ['.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx'];

/** First path that exists once an extension is appended, if any. */
function withExtension(basePath) {
  for (const ext of EXTENSIONS) {
    const candidate = `${basePath}${ext}`;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // "@/lib/x" -> "<repo>/lib/x"
  if (specifier.startsWith('@/')) {
    const target = resolvePath(repoRoot, specifier.slice(2));
    const resolved = existsSync(target) ? target : withExtension(target);
    if (resolved) return nextResolve(pathToFileURL(resolved).href, context);
  }

  // "./archetypes" -> "./archetypes.ts", relative to the importing module.
  if (specifier.startsWith('.') && context.parentURL) {
    const target = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
    if (!existsSync(target)) {
      const resolved = withExtension(target);
      if (resolved) return nextResolve(pathToFileURL(resolved).href, context);
    }
  }

  return nextResolve(specifier, context);
}
