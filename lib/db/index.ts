import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

/**
 * Database handle.
 *
 * One connection string covers both deployments:
 *   DATABASE_URL=file:./kiln.db                  — self-hosted, zero setup
 *   DATABASE_URL=libsql://…  + DATABASE_AUTH_TOKEN — hosted (Turso)
 *
 * The client is created once per process and reused. It is created lazily so
 * that importing this module during a build, or in a deployment that has no
 * database yet, does not throw — `isDatabaseConfigured()` is the check to use
 * before reaching for it.
 */

export const DEFAULT_DATABASE_URL = 'file:./kiln.db';

function connectionUrl(): string {
  return process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
}

/** True when a database is reachable enough to try. */
export function isDatabaseConfigured(): boolean {
  const url = connectionUrl();
  // A remote URL without its token will fail on first query, so treat the
  // pair as the unit of configuration rather than reporting a false ready.
  if (url.startsWith('libsql://') || url.startsWith('https://')) {
    return Boolean(process.env.DATABASE_AUTH_TOKEN?.trim());
  }
  return true;
}

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (cached) return cached;

  const client = createClient({
    url: connectionUrl(),
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  cached = drizzle(client, { schema });
  return cached;
}

/** Test seam: drops the cached handle so a new URL takes effect. */
export function __resetDb(): void {
  cached = null;
}

export { schema };
export * from './schema';
