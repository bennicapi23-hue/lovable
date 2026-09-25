#!/usr/bin/env node
/**
 * Applies database migrations. Run after install and on every deploy:
 *
 *   pnpm db:migrate
 *
 * Safe to run repeatedly; Drizzle tracks what it has already applied.
 */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
for (const file of ['.env.local', '.env']) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) require('dotenv').config({ path, override: false });
}

const url = process.env.DATABASE_URL?.trim() || 'file:./kiln.db';

if ((url.startsWith('libsql://') || url.startsWith('https://')) && !process.env.DATABASE_AUTH_TOKEN) {
  console.error('\n✖ DATABASE_URL points at a remote database but DATABASE_AUTH_TOKEN is not set.\n');
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });

try {
  await migrate(drizzle(client), { migrationsFolder: './lib/db/migrations' });
  console.log(`\n✔ Database up to date (${url}).\n`);
} catch (error) {
  console.error(`\n✖ Migration failed: ${error.message}\n`);
  process.exit(1);
} finally {
  client.close();
}
