import type { NextRequest } from 'next/server';
import { DEFAULT_PLAN_ID, getPlan, type Plan, type PlanId } from '@/config/plans.config';

/**
 * Entitlements and metering.
 *
 * This is the enforcement point for what config/plans.config.ts promises.
 * It is deliberately split from whatever identity system an operator plugs
 * in: `resolveAccount` is the single seam. Wire it to your auth and billing
 * provider and every gated route starts enforcing real plans without any
 * other change.
 *
 * Out of the box it resolves every caller to a single local account on the
 * plan named by KILN_DEFAULT_PLAN. That makes a self-hosted install work
 * immediately, while the metering below still runs, so quota behaviour can
 * be seen and tested before billing is connected.
 *
 * Usage counters live in memory and reset when the process does. For a
 * multi-instance deployment, replace the counter store with a shared one —
 * `usageStore` is the seam for that.
 */

export interface Account {
  id: string;
  planId: PlanId;
  /** Present once a billing provider is connected. */
  customerId?: string;
}

export type MeteredAction = 'build' | 'edit';

export interface EntitlementCheck {
  allowed: boolean;
  plan: Plan;
  /** Why it was refused, safe to show the user. */
  reason?: string;
  /** Remaining allowance for the metered action that was checked. */
  remaining?: number;
  /** When the current window resets, as an ISO string. */
  resetsAt?: string;
}

/* ------------------------------------------------------------------ store */

interface UsageWindow {
  build: number;
  edit: number;
  /** Epoch ms at which this window ends. */
  resetsAt: number;
}

const usageStore = new Map<string, UsageWindow>();

/** Start of the next calendar month, in UTC. */
function nextMonthBoundary(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

function currentWindow(accountId: string, now = Date.now()): UsageWindow {
  const existing = usageStore.get(accountId);
  if (existing && existing.resetsAt > now) return existing;

  const fresh: UsageWindow = { build: 0, edit: 0, resetsAt: nextMonthBoundary(now) };
  usageStore.set(accountId, fresh);
  return fresh;
}

/* -------------------------------------------------------------- identity */

/**
 * Resolves the calling account.
 *
 * Replace this with a lookup against your session/JWT and billing records.
 * The rest of this module does not care how identity is established.
 */
export async function resolveAccount(_request: NextRequest): Promise<Account> {
  const configured = process.env.KILN_DEFAULT_PLAN as PlanId | undefined;
  const planId = getPlan(configured).id;
  return { id: 'local', planId };
}

/* ------------------------------------------------------------ enforcement */

/** True when the account's plan includes a named capability. */
export function hasEntitlement(account: Account, entitlement: string): boolean {
  return getPlan(account.planId).entitlements.includes(entitlement);
}

function limitFor(plan: Plan, action: MeteredAction): number {
  return action === 'build' ? plan.limits.buildsPerMonth : plan.limits.editsPerMonth;
}

/**
 * Checks an action without consuming allowance. Use before doing expensive
 * setup work, then call `recordUsage` once the action actually happens.
 */
export function checkAllowance(account: Account, action: MeteredAction): EntitlementCheck {
  const plan = getPlan(account.planId);

  if (!plan.entitlements.includes(action)) {
    return {
      allowed: false,
      plan,
      reason: `The ${plan.name} plan does not include ${action}s.`,
    };
  }

  const limit = limitFor(plan, action);
  if (!Number.isFinite(limit)) {
    return { allowed: true, plan, remaining: Number.POSITIVE_INFINITY };
  }

  const window = currentWindow(account.id);
  const used = window[action];
  const remaining = Math.max(0, limit - used);

  if (used >= limit) {
    return {
      allowed: false,
      plan,
      remaining: 0,
      resetsAt: new Date(window.resetsAt).toISOString(),
      reason:
        `You have used all ${limit.toLocaleString('en-GB')} ${action}s on the ` +
        `${plan.name} plan this month. Upgrade for more, or wait for the reset.`,
    };
  }

  return {
    allowed: true,
    plan,
    remaining,
    resetsAt: new Date(window.resetsAt).toISOString(),
  };
}

/** Consumes one unit of allowance. Call only when the action really ran. */
export function recordUsage(account: Account, action: MeteredAction, units = 1): void {
  const window = currentWindow(account.id);
  window[action] += units;
}

/**
 * Convenience wrapper for route handlers: resolve, check, and return the
 * pieces a route needs to either proceed or refuse.
 */
export async function authorizeAction(
  request: NextRequest,
  action: MeteredAction,
): Promise<{ account: Account; check: EntitlementCheck }> {
  const account = await resolveAccount(request);
  return { account, check: checkAllowance(account, action) };
}

/** Current usage, for a dashboard or an account page. */
export function usageSnapshot(account: Account): {
  plan: Plan;
  builds: { used: number; limit: number };
  edits: { used: number; limit: number };
  resetsAt: string;
} {
  const plan = getPlan(account.planId);
  const window = currentWindow(account.id);
  return {
    plan,
    builds: { used: window.build, limit: plan.limits.buildsPerMonth },
    edits: { used: window.edit, limit: plan.limits.editsPerMonth },
    resetsAt: new Date(window.resetsAt).toISOString(),
  };
}

/** Test seam. */
export function __resetUsage(): void {
  usageStore.clear();
}

export { DEFAULT_PLAN_ID };
