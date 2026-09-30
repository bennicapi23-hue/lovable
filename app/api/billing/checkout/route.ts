import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { resolveAccount } from '@/lib/billing/session';
import { getDb, users } from '@/lib/db';
import { getPlan, type PlanId } from '@/config/plans.config';
import { ensureCustomer, getStripe, isBillingConfigured, priceIdFor } from '@/lib/billing/stripe';
import { rateLimit } from '@/lib/security/rate-limit';
import { brand } from '@/config/brand.config';

export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/checkout
 *
 * Starts a Stripe Checkout session and returns its URL.
 *
 * The plan comes from the request but the price never does: it is looked up
 * server-side from configuration. A client that could name its own price
 * could name its own amount.
 */
export async function POST(request: NextRequest) {
  const limit = await rateLimit(request, { bucket: 'checkout', limit: 10, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many attempts.' }, { status: 429, headers: limit.headers });
  }

  if (!isBillingConfigured()) {
    return NextResponse.json(
      { error: 'This deployment does not sell subscriptions.' },
      { status: 501 },
    );
  }

  const account = await resolveAccount(request);
  if (!account) {
    return NextResponse.json({ error: 'Sign in first.', signIn: '/sign-in' }, { status: 401 });
  }

  let body: { plan?: unknown; period?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const planId = String(body.plan ?? '') as PlanId;
  const plan = getPlan(planId);
  const period = body.period === 'annual' ? 'annual' : 'monthly';

  // getPlan falls back to the free plan for anything it does not recognise,
  // so compare ids rather than trusting that it found what was asked for.
  if (plan.id !== planId || plan.monthly === null || plan.monthly === 0) {
    return NextResponse.json({ error: 'That plan cannot be bought.' }, { status: 400 });
  }

  const price = priceIdFor(plan.id, period);
  if (!price) {
    return NextResponse.json(
      { error: `No ${period} price is configured for the ${plan.name} plan.` },
      { status: 501 },
    );
  }

  try {
    const db = getDb();
    const [row] = await db
      .select({ email: users.email, customerId: users.billingCustomerId })
      .from(users)
      .where(eq(users.id, account.id))
      .limit(1);

    const customerId = await ensureCustomer({
      accountId: account.id,
      email: row?.email,
      existingCustomerId: row?.customerId,
    });

    // Persist before redirecting: if the user pays and comes back, the
    // webhook must be able to match the customer to this account even if
    // nothing else about the session survived.
    if (row?.customerId !== customerId) {
      await db.update(users).set({ billingCustomerId: customerId }).where(eq(users.id, account.id));
    }

    const origin = request.headers.get('origin') || brand.urls.app;

    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/account?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
      // Selling software into the EU means VAT. Stripe Tax computes it;
      // without this the operator is liable for the difference.
      automatic_tax: { enabled: true },
      customer_update: { address: 'auto', name: 'auto' },
      // Both sides carry the account id: the checkout session for the
      // immediate confirmation, the subscription for every later event.
      metadata: { kilnAccountId: account.id, kilnPlanId: plan.id },
      subscription_data: {
        metadata: { kilnAccountId: account.id, kilnPlanId: plan.id },
      },
    });

    return NextResponse.json({ url: session.url }, { headers: limit.headers });
  } catch (error) {
    console.error('[billing/checkout] failed:', error);
    return NextResponse.json(
      { error: 'Could not start checkout. Try again shortly.' },
      { status: 502 },
    );
  }
}
