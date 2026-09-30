import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { getDb, users } from '@/lib/db';
import { getStripe, isBillingConfigured, planForPriceId, accountIdFrom } from '@/lib/billing/stripe';
import { DEFAULT_PLAN_ID, type PlanId } from '@/config/plans.config';

export const dynamic = 'force-dynamic';
// The signature is computed over the exact bytes Stripe sent, so the body
// must not be parsed or re-encoded before it is verified.
export const runtime = 'nodejs';

/**
 * POST /api/billing/webhook
 *
 * The only thing that moves an account between plans.
 *
 * Deliberately not driven by the checkout redirect: a user who closes the tab
 * after paying still gets their plan, and a user who forges a redirect gets
 * nothing. Stripe is the source of truth and this endpoint trusts nothing but
 * a valid signature.
 */
export async function POST(request: NextRequest) {
  if (!isBillingConfigured()) {
    return NextResponse.json({ error: 'Billing is not configured.' }, { status: 501 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    // Without the signing secret every caller is unauthenticated, and acting
    // on unverified events would let anyone grant themselves a plan.
    console.error('[billing/webhook] STRIPE_WEBHOOK_SECRET is not set; refusing');
    return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 501 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    console.error('[billing/webhook] signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  try {
    await handle(event);
  } catch (error) {
    // A 500 makes Stripe retry, which is what we want for a transient
    // failure. Returning 200 here would silently drop the event and leave
    // the customer paying for a plan they never received.
    console.error(`[billing/webhook] handling ${event.type} failed:`, error);
    return NextResponse.json({ error: 'Handler failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handle(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      // The subscription events carry the price, so the plan is applied
      // there. This case only ties the customer to the account.
      const accountId = accountIdFrom(session);
      if (accountId && typeof session.customer === 'string') {
        await linkCustomer(accountId, session.customer);
      }
      return;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const accountId = await accountFor(subscription);
      if (!accountId) return;

      // past_due keeps access: dunning has not finished and cutting someone
      // off over a card that expired yesterday loses customers who would
      // have paid. unpaid and canceled do not.
      const entitled = ['active', 'trialing', 'past_due'].includes(subscription.status);
      const plan = entitled ? planFromSubscription(subscription) : DEFAULT_PLAN_ID;

      await applyPlan(accountId, plan ?? DEFAULT_PLAN_ID);
      return;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const accountId = await accountFor(subscription);
      if (accountId) await applyPlan(accountId, DEFAULT_PLAN_ID);
      return;
    }

    default:
      // Everything else is acknowledged and ignored, so Stripe stops
      // retrying events this product has no opinion about.
      return;
  }
}

/** The plan a subscription's first recurring price maps to. */
function planFromSubscription(subscription: Stripe.Subscription): PlanId | null {
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) return null;

  const mapped = planForPriceId(priceId);
  if (mapped) return mapped;

  // A price that exists in Stripe but not in configuration means the two
  // have drifted. Refusing to guess is safer than granting the wrong tier.
  console.error(`[billing/webhook] price ${priceId} maps to no configured plan`);
  return null;
}

/**
 * Resolves the account a subscription belongs to.
 *
 * Metadata first, because it is set at checkout and survives. The customer id
 * is the fallback for subscriptions created in the Stripe dashboard, which
 * carry no metadata of ours.
 */
async function accountFor(subscription: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = accountIdFrom(subscription);
  if (fromMetadata) return fromMetadata;

  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  if (!customerId) return null;

  const [row] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.billingCustomerId, customerId))
    .limit(1);

  if (!row) {
    console.error(`[billing/webhook] no account for customer ${customerId}`);
    return null;
  }
  return row.id;
}

async function linkCustomer(accountId: string, customerId: string): Promise<void> {
  await getDb().update(users).set({ billingCustomerId: customerId }).where(eq(users.id, accountId));
}

async function applyPlan(accountId: string, planId: PlanId): Promise<void> {
  await getDb().update(users).set({ planId }).where(eq(users.id, accountId));
  console.log(`[billing/webhook] account ${accountId} is now on ${planId}`);
}
