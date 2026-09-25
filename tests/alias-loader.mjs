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
import { existsSync, statSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSIONS = ['.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx'];

/** True when the path exists and is a file Node can load directly. */
function isFile(path) {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * First path that exists once an extension is appended, if any.
 *
 * A bare directory ("@/lib/db") must fall through to its index file rather
 * than resolving to the directory itself, which Node refuses to import.
 */
function withExtension(basePath) {
  for (const ext of EXTENSIONS) {
    const candidate = `${basePath}${ext}`;
    if (isFile(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // "@/lib/x" -> "<repo>/lib/x"
  if (specifier.startsWith('@/')) {
    const target = resolvePath(repoRoot, specifier.slice(2));
    const resolved = isFile(target) ? target : withExtension(target);
    if (resolved) return nextResolve(pathToFileURL(resolved).href, context);
  }

  // "./archetypes" -> "./archetypes.ts", relative to the importing module.
  if (specifier.startsWith('.') && context.parentURL) {
    const target = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
    if (!isFile(target)) {
      const resolved = withExtension(target);
      if (resolved) return nextResolve(pathToFileURL(resolved).href, context);
    }
  }

  return nextResolve(specifier, context);
}
