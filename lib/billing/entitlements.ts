import { and, eq, sql } from 'drizzle-orm';
import { DEFAULT_PLAN_ID, getPlan, type Plan, type PlanId } from '@/config/plans.config';
import { getDb, usage, users } from '@/lib/db';

/**
 * Entitlements and metering.
 *
 * This is the enforcement point for what config/plans.config.ts promises.
 * Usage counters live in the database, so a limit survives a deploy and
 * applies across instances — which is what makes a plan limit a limit rather
 * than a suggestion.
 *
 * Deliberately depends on nothing but the database. Resolving *who* is asking
 * needs the Auth.js runtime, which drags in the whole Next server; keeping
 * that in lib/billing/session.ts means the metering rules stay testable on
 * their own and the framework stays at the edge.
 */

export interface Account {
  id: string;
  planId: PlanId;
  email?: string | null;
}

export type MeteredAction = 'build' | 'edit';

export interface EntitlementCheck {
  allowed: boolean;
  plan: Plan;
  reason?: string;
  remaining?: number;
  resetsAt?: string;
  /** Distinguishes "sign in" from "you are out of builds" at the call site. */
  unauthenticated?: boolean;
}

/* ----------------------------------------------------------------- period */

/** Current metering window, 'YYYY-MM' in UTC. */
export function currentPeriod(at: Date = new Date()): string {
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Start of the next window, which is when allowances come back. */
export function periodResetsAt(at: Date = new Date()): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
}

/* ------------------------------------------------------------ enrolment */

export function hasEntitlement(account: Account, entitlement: string): boolean {
  return getPlan(account.planId).entitlements.includes(entitlement);
}

function limitFor(plan: Plan, action: MeteredAction): number {
  return action === 'build' ? plan.limits.buildsPerMonth : plan.limits.editsPerMonth;
}

/** Usage for this account in the current window, creating the row if absent. */
async function readUsage(accountId: string): Promise<{ build: number; edit: number }> {
  const period = currentPeriod();
  const [row] = await getDb()
    .select({ builds: usage.builds, edits: usage.edits })
    .from(usage)
    .where(and(eq(usage.userId, accountId), eq(usage.period, period)))
    .limit(1);

  return { build: row?.builds ?? 0, edit: row?.edits ?? 0 };
}

/**
 * Checks an action without consuming allowance. Call before doing expensive
 * setup, then `recordUsage` once the action actually starts.
 */
export async function checkAllowance(
  account: Account,
  action: MeteredAction,
): Promise<EntitlementCheck> {
  const plan = getPlan(account.planId);

  if (!plan.entitlements.includes(action)) {
    return { allowed: false, plan, reason: `The ${plan.name} plan does not include ${action}s.` };
  }

  const limit = limitFor(plan, action);
  const resetsAt = periodResetsAt().toISOString();

  if (!Number.isFinite(limit)) {
    return { allowed: true, plan, remaining: Number.POSITIVE_INFINITY, resetsAt };
  }

  const used = (await readUsage(account.id))[action];
  const remaining = Math.max(0, limit - used);

  if (used >= limit) {
    return {
      allowed: false,
      plan,
      remaining: 0,
      resetsAt,
      reason:
        `You have used all ${limit.toLocaleString('en-GB')} ${action}s on the ` +
        `${plan.name} plan this month. Upgrade for more, or wait for the reset.`,
    };
  }

  return { allowed: true, plan, remaining, resetsAt };
}

/**
 * Consumes allowance.
 *
 * Written as an upsert so two builds starting at once cannot both read zero
 * and both write one. The increment happens in the database, not in
 * JavaScript, so the count is right under concurrency.
 */
export async function recordUsage(
  account: Account,
  action: MeteredAction,
  units = 1,
): Promise<void> {
  const period = currentPeriod();
  const column = action === 'build' ? 'builds' : 'edits';

  await getDb()
    .insert(usage)
    .values({
      userId: account.id,
      period,
      builds: action === 'build' ? units : 0,
      edits: action === 'edit' ? units : 0,
    })
    .onConflictDoUpdate({
      target: [usage.userId, usage.period],
      set: {
        [column]: sql`${sql.identifier(column)} + ${units}`,
        updatedAt: sql`(unixepoch() * 1000)`,
      },
    });
}

/** Current usage, for the account page. */
export async function usageSnapshot(account: Account) {
  const plan = getPlan(account.planId);
  const used = await readUsage(account.id);
  return {
    plan,
    builds: { used: used.build, limit: plan.limits.buildsPerMonth },
    edits: { used: used.edit, limit: plan.limits.editsPerMonth },
    period: currentPeriod(),
    resetsAt: periodResetsAt().toISOString(),
  };
}

/** Moves an account onto a plan. The seam a billing webhook calls. */
export async function setPlan(accountId: string, planId: PlanId): Promise<void> {
  await getDb().update(users).set({ planId: getPlan(planId).id }).where(eq(users.id, accountId));
}

export { DEFAULT_PLAN_ID };
