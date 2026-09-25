import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'file:./kiln.db',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
} satisfies Config;
