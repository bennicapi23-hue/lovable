import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { resolveAccount } from '@/lib/billing/session';
import { getDb, users } from '@/lib/db';
import { getStripe, isBillingConfigured } from '@/lib/billing/stripe';
import { brand } from '@/config/brand.config';

export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/portal
 *
 * Opens Stripe's billing portal, which handles card updates, invoices,
 * cancellation and plan changes. Building those screens ourselves would mean
 * reimplementing dunning and tax receipts badly.
 */
export async function POST(request: NextRequest) {
  if (!isBillingConfigured()) {
    return NextResponse.json({ error: 'Billing is not configured.' }, { status: 501 });
  }

  const account = await resolveAccount(request);
  if (!account) {
    return NextResponse.json({ error: 'Sign in first.', signIn: '/sign-in' }, { status: 401 });
  }

  const [row] = await getDb()
    .select({ customerId: users.billingCustomerId })
    .from(users)
    .where(eq(users.id, account.id))
    .limit(1);

  if (!row?.customerId) {
    return NextResponse.json(
      { error: 'There is nothing to manage yet — this account has never subscribed.' },
      { status: 400 },
    );
  }

  try {
    const origin = request.headers.get('origin') || brand.urls.app;
    const session = await getStripe().billingPortal.sessions.create({
      customer: row.customerId,
      return_url: `${origin}/account`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[billing/portal] failed:', error);
    return NextResponse.json({ error: 'Could not open the billing portal.' }, { status: 502 });
  }
}
