import { migrate } from 'drizzle-orm/libsql/migrator';
import { getDb } from './index';

/**
 * Applies any pending migrations.
 *
 * Called by `pnpm db:migrate` and safe to run repeatedly — Drizzle records
 * what it has applied. Run it on deploy, before the app takes traffic.
 */
export async function runMigrations(): Promise<void> {
  await migrate(getDb(), { migrationsFolder: './lib/db/migrations' });
}
