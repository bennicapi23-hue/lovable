import { NextRequest, NextResponse } from 'next/server';
import { usageSnapshot } from '@/lib/billing/entitlements';
import { resolveAccount } from '@/lib/billing/session';

export const dynamic = 'force-dynamic';

/** GET /api/account — who is signed in, on what plan, and how much is left. */
export async function GET(request: NextRequest) {
  const account = await resolveAccount(request);
  if (!account) {
    return NextResponse.json({ signedIn: false }, { status: 401 });
  }

  const snapshot = await usageSnapshot(account);

  // JSON.stringify turns Infinity into null, which a client would read as
  // "unknown" rather than "unlimited". Send the distinction explicitly.
  const meter = (m: { used: number; limit: number }) => ({
    used: m.used,
    limit: Number.isFinite(m.limit) ? m.limit : null,
    unlimited: !Number.isFinite(m.limit),
    remaining: Number.isFinite(m.limit) ? Math.max(0, m.limit - m.used) : null,
  });

  return NextResponse.json({
    signedIn: true,
    email: account.email,
    plan: { id: snapshot.plan.id, name: snapshot.plan.name },
    usage: {
      builds: meter(snapshot.builds),
      edits: meter(snapshot.edits),
      period: snapshot.period,
      resetsAt: snapshot.resetsAt,
    },
  }, {
    // Usage changes per request; a cached answer would show stale allowance.
    headers: { 'Cache-Control': 'no-store' },
  });
}
