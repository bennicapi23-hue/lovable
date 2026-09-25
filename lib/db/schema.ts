import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/**
 * Kiln's data model.
 *
 * One dialect (libSQL) covers both deployments: a local file for a
 * self-hosted install and hosted Turso in production. Supporting Postgres as
 * well would mean maintaining a second, divergent schema for no behavioural
 * gain, so it is deliberately out of scope.
 *
 * Timestamps are epoch milliseconds in integer columns rather than a date
 * type, because SQLite has no native one and storing text dates makes range
 * queries quietly wrong.
 */

const now = sql`(unixepoch() * 1000)`;

/* ------------------------------------------------------------------ auth */
/* The four tables below are the shape Auth.js expects from its adapter.
   Field names are fixed by the adapter contract — do not rename them. */

export const users = sqliteTable('user', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').notNull(),
  emailVerified: integer('emailVerified', { mode: 'timestamp_ms' }),
  image: text('image'),

  /* --- Kiln's own columns ------------------------------------------- */
  /** scrypt digest, "salt:hash" hex. Null for OAuth-only accounts. */
  passwordHash: text('password_hash'),
  /** Plan id from config/plans.config.ts. */
  planId: text('plan_id').notNull().default('free'),
  /** Set once a billing provider is connected. */
  billingCustomerId: text('billing_customer_id'),
  createdAt: integer('created_at').notNull().default(now),
}, (table) => [
  uniqueIndex('user_email_unique').on(table.email),
]);

export const accounts = sqliteTable('account', {
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (table) => [
  primaryKey({ columns: [table.provider, table.providerAccountId] }),
]);

export const sessions = sqliteTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const verificationTokens = sqliteTable('verificationToken', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.identifier, table.token] }),
]);

/* --------------------------------------------------------------- product */

export const projects = sqliteTable('project', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  name: text('name').notNull(),
  tagline: text('tagline'),
  /** 'create' for a greenfield build, 'clone' for a URL rebuild. */
  origin: text('origin', { enum: ['create', 'clone'] }).notNull().default('create'),
  /** The description or URL the project started from. */
  source: text('source'),
  /** The approved blueprint, as JSON. Null for clones, which have no plan. */
  blueprint: text('blueprint', { mode: 'json' }),

  /** Last sandbox this project ran in. Sandboxes are ephemeral, so this goes
      stale by design — it is a reconnect hint, not a guarantee. */
  lastSandboxId: text('last_sandbox_id'),

  archivedAt: integer('archived_at'),
  createdAt: integer('created_at').notNull().default(now),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  index('project_user_idx').on(table.userId, table.updatedAt),
]);

/**
 * A snapshot of the generated tree. Kept per build rather than per project so
 * a user can look at what an earlier build produced — the "version history"
 * the paid plans promise.
 */
export const builds = sqliteTable('build', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  kind: text('kind', { enum: ['build', 'edit'] }).notNull().default('build'),
  prompt: text('prompt'),
  model: text('model'),
  /** { path: contents } for every file this build wrote. */
  files: text('files', { mode: 'json' }),
  status: text('status', { enum: ['running', 'succeeded', 'failed'] }).notNull().default('running'),
  error: text('error'),

  createdAt: integer('created_at').notNull().default(now),
  finishedAt: integer('finished_at'),
}, (table) => [
  index('build_project_idx').on(table.projectId, table.createdAt),
]);

/**
 * Metered usage, one row per calendar month per user.
 *
 * Counters previously lived in a process Map, so they reset on every deploy
 * and a user on a second instance got a fresh allowance. Storing them makes
 * the plan limits actually mean something.
 */
export const usage = sqliteTable('usage', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** 'YYYY-MM' in UTC. The window plan limits reset on. */
  period: text('period').notNull(),
  builds: integer('builds').notNull().default(0),
  edits: integer('edits').notNull().default(0),
  updatedAt: integer('updated_at').notNull().default(now),
}, (table) => [
  primaryKey({ columns: [table.userId, table.period] }),
]);

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Build = typeof builds.$inferSelect;
export type Usage = typeof usage.$inferSelect;
