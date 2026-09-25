import { NextRequest, NextResponse } from 'next/server';
import { resolveAccount } from '@/lib/billing/session';
import { archiveProject, getProject, listBuilds, touchProject } from '@/lib/db/projects';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** GET /api/projects/:id — one project with its build history. */
export async function GET(request: NextRequest, { params }: Params) {
  const account = await resolveAccount(request);
  if (!account) return NextResponse.json({ error: 'Sign in.' }, { status: 401 });

  const { id } = await params;
  const project = await getProject(account.id, id);
  // A project belonging to someone else is reported as absent rather than
  // forbidden, so this route cannot be used to discover that an id exists.
  if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });

  return NextResponse.json({ project, builds: await listBuilds(account.id, id) });
}

/** PATCH /api/projects/:id — rename, or record the sandbox it is running in. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const account = await resolveAccount(request);
  if (!account) return NextResponse.json({ error: 'Sign in.' }, { status: 401 });

  const { id } = await params;
  if (!(await getProject(account.id, id))) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  await touchProject(account.id, id, {
    ...(typeof body.name === 'string' && body.name.trim() ? { name: body.name.trim() } : {}),
    ...(typeof body.lastSandboxId === 'string' ? { lastSandboxId: body.lastSandboxId } : {}),
  });

  return NextResponse.json({ success: true });
}

/** DELETE /api/projects/:id — archives rather than destroys. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const account = await resolveAccount(request);
  if (!account) return NextResponse.json({ error: 'Sign in.' }, { status: 401 });

  const { id } = await params;
  if (!(await getProject(account.id, id))) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  await archiveProject(account.id, id);
  return NextResponse.json({ success: true });
}
