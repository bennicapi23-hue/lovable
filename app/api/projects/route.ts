import { NextRequest, NextResponse } from 'next/server';
import { resolveAccount } from '@/lib/billing/session';
import { createProject, listProjects } from '@/lib/db/projects';
import { rateLimit } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/** GET /api/projects — the caller's projects, newest activity first. */
export async function GET(request: NextRequest) {
  const account = await resolveAccount(request);
  if (!account) {
    return NextResponse.json({ error: 'Sign in to see your projects.' }, { status: 401 });
  }

  return NextResponse.json({ projects: await listProjects(account.id) });
}

/** POST /api/projects — records a project when a build starts. */
export async function POST(request: NextRequest) {
  const limit = await rateLimit(request, { bucket: 'projects', limit: 60, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429, headers: limit.headers });
  }

  const account = await resolveAccount(request);
  if (!account) {
    return NextResponse.json({ error: 'Sign in to save a project.' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name : '';
  if (!name.trim()) {
    return NextResponse.json({ error: 'A project needs a name.' }, { status: 400 });
  }

  const project = await createProject({
    userId: account.id,
    name,
    tagline: typeof body.tagline === 'string' ? body.tagline : null,
    origin: body.origin === 'clone' ? 'clone' : 'create',
    source: typeof body.source === 'string' ? body.source : null,
    blueprint: (body.blueprint as never) ?? null,
  });

  return NextResponse.json({ project }, { status: 201, headers: limit.headers });
}
