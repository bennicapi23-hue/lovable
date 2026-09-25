import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/config';
import { getPlan, DEFAULT_PLAN_ID } from '@/config/plans.config';
import {
  checkAllowance,
  type Account,
  type EntitlementCheck,
  type MeteredAction,
} from './entitlements';

/**
 * The bridge between a request and an account.
 *
 * Kept apart from entitlements.ts because this is the only part that needs
 * the Auth.js runtime. Route handlers import from here; the metering rules
 * themselves stay free of the web framework.
 */

/**
 * Resolves the calling account from the session.
 *
 * Returns null when nobody is signed in. Callers must treat that as "refuse",
 * never "fall back to a default account" — that fallback is exactly how a
 * metered product ends up giving its work away.
 */
export async function resolveAccount(_request?: NextRequest): Promise<Account | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  return {
    id,
    planId: getPlan(session.user.planId).id,
    email: session.user.email,
  };
}

/**
 * Route-handler convenience: resolve, check, and hand back what a route needs
 * to proceed or refuse.
 */
export async function authorizeAction(
  request: NextRequest,
  action: MeteredAction,
): Promise<{ account: Account | null; check: EntitlementCheck }> {
  const account = await resolveAccount(request);

  if (!account) {
    return {
      account: null,
      check: {
        allowed: false,
        unauthenticated: true,
        plan: getPlan(DEFAULT_PLAN_ID),
        reason: 'Sign in to build.',
      },
    };
  }

  return { account, check: await checkAllowance(account, action) };
}
