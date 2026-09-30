import Stripe from 'stripe';
import { PLANS, type PlanId } from '@/config/plans.config';

/**
 * Stripe wiring.
 *
 * Everything here is optional at runtime: an install with no Stripe keys
 * still runs, with paid plans simply unavailable. That keeps the self-hosted
 * path — where the operator pays their own model and sandbox bills and has no
 * reason to charge anyone — working without a payment processor.
 *
 * Price ids are configuration, not code. A plan without a price id cannot be
 * bought, which is the correct behaviour for a half-configured deployment:
 * refuse the checkout rather than charge the wrong amount.
 */

let client: Stripe | null = null;

export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripe(): Stripe {
  if (!isBillingConfigured()) {
    throw new Error('Stripe is not configured on this deployment.');
  }
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      // Pinning the version means a Stripe-side upgrade cannot change the
      // shape of what we parse without a deliberate change here.
      apiVersion: '2026-08-26.dahlia',
      typescript: true,
      appInfo: { name: 'Kiln', version: '1.0.0' },
    });
  }
  return client;
}

/* ---------------------------------------------------------------- prices */

/**
 * Price id for a plan and billing period.
 *
 * Read from the environment because the same code runs against test and live
 * Stripe accounts, which never share ids.
 */
export function priceIdFor(planId: PlanId, period: 'monthly' | 'annual'): string | null {
  const key = `STRIPE_PRICE_${planId.toUpperCase()}_${period.toUpperCase()}`;
  return process.env[key]?.trim() || null;
}

/** Plans this deployment can actually sell. */
export function purchasablePlans(): PlanId[] {
  if (!isBillingConfigured()) return [];
  return PLANS.filter(
    (plan) =>
      plan.monthly !== null &&
      plan.monthly > 0 &&
      (priceIdFor(plan.id, 'monthly') || priceIdFor(plan.id, 'annual')),
  ).map((plan) => plan.id);
}

/**
 * Maps a Stripe price back to a plan.
 *
 * The webhook receives a price id and must decide which plan the customer is
 * now on. Doing it by lookup rather than by storing the plan on the session
 * means a price changed in the Stripe dashboard is reflected without a deploy.
 */
export function planForPriceId(priceId: string): PlanId | null {
  for (const plan of PLANS) {
    for (const period of ['monthly', 'annual'] as const) {
      if (priceIdFor(plan.id, period) === priceId) return plan.id;
    }
  }
  return null;
}

/* ------------------------------------------------------------- customers */

/**
 * Finds or creates the Stripe customer for an account.
 *
 * The id is stored on our side so a second checkout reuses the same customer
 * and the billing portal shows one coherent history rather than a new
 * customer per purchase.
 */
export async function ensureCustomer(input: {
  accountId: string;
  email?: string | null;
  existingCustomerId?: string | null;
}): Promise<string> {
  const stripe = getStripe();

  if (input.existingCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(input.existingCustomerId);
      if (!existing.deleted) return existing.id;
    } catch {
      // Deleted in the dashboard, or belongs to the other (test/live) mode.
      // Fall through and make a new one rather than failing the checkout.
    }
  }

  const customer = await stripe.customers.create({
    email: input.email ?? undefined,
    // Lets the webhook identify the account without trusting client input.
    metadata: { kilnAccountId: input.accountId },
  });

  return customer.id;
}

/** The account id a Stripe object belongs to, from metadata. */
export function accountIdFrom(
  object: { metadata?: Stripe.Metadata | null } | null | undefined,
): string | null {
  return object?.metadata?.kilnAccountId || null;
}
