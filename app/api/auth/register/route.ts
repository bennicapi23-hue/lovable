import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, users } from '@/lib/db';
import { hashPassword, validatePassword } from '@/lib/auth/password';
import { rateLimit } from '@/lib/security/rate-limit';
import { DEFAULT_PLAN_ID } from '@/config/plans.config';

export const dynamic = 'force-dynamic';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * POST /api/auth/register
 *
 * Creates a Credentials account. Sign-in itself is handled by Auth.js; this
 * only exists because Auth.js deliberately has no opinion on registration.
 */
export async function POST(request: NextRequest) {
  // Registration is a cheap way to probe for existing accounts and to fill a
  // database, so it is limited harder than the read endpoints.
  const limit = await rateLimit(request, { bucket: 'register', limit: 5, windowMs: 600_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many sign-up attempts. Try again later.' },
      { status: 429, headers: limit.headers },
    );
  }

  let body: { email?: unknown; password?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : null;

  if (!EMAIL.test(email) || email.length > 320) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const strength = validatePassword(password);
  if (!strength.ok) {
    return NextResponse.json({ error: strength.reason }, { status: 400 });
  }

  const db = getDb();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    // Deliberately vague: confirming which addresses are registered turns
    // this endpoint into an account-enumeration oracle.
    return NextResponse.json(
      { error: 'That email cannot be used. Try signing in instead.' },
      { status: 409 },
    );
  }

  try {
    await db.insert(users).values({
      email,
      name,
      passwordHash: await hashPassword(password),
      planId: DEFAULT_PLAN_ID,
    });
  } catch (error) {
    // The unique index is the real guard against two simultaneous sign-ups
    // for one address; the select above only narrows the window.
    console.error('[register] insert failed:', error);
    return NextResponse.json(
      { error: 'That email cannot be used. Try signing in instead.' },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true }, { status: 201, headers: limit.headers });
}
