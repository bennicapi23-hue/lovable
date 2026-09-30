import type { NextRequest } from 'next/server';
import { resolveAccount } from '@/lib/billing/session';
import { getPlan } from '@/config/plans.config';
import {
  countSessions,
  currentSession,
  getSession,
  openSession,
  type BuildSession,
} from './session-store';

/**
 * Resolving a request to the build session it acts on.
 *
 * Every sandbox route needs the same three steps — who is asking, which of
 * their sessions, and is there one at all — so they live here rather than
 * being repeated eighteen times with eighteen slightly different mistakes.
 */

export type SessionLookup =
  | { ok: true; session: BuildSession; accountId: string }
  | { ok: false; status: 401 | 404 | 409; error: string };

/** The sandbox id a request names, from the header or the body. */
export function sessionIdFrom(request: NextRequest, body?: unknown): string | null {
  const header = request.headers.get('x-kiln-sandbox');
  if (header) return header;

  const url = new URL(request.url).searchParams.get('sandboxId');
  if (url) return url;

  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    if (typeof record.sandboxId === 'string') return record.sandboxId;

    const context = record.context;
    if (context && typeof context === 'object') {
      const id = (context as Record<string, unknown>).sandboxId;
      if (typeof id === 'string') return id;
    }
  }

  return null;
}

/**
 * Finds the session a request is about.
 *
 * When the request names a sandbox, that one is used — and an id belonging to
 * someone else resolves to nothing, so it reads as "not found" rather than
 * leaking that it exists. When it names none, the caller's most recent
 * session is used, which is what the inherited routes assumed all along; the
 * difference is that it is now scoped to one account.
 */
export async function requireSession(
  request: NextRequest,
  body?: unknown,
): Promise<SessionLookup> {
  const account = await resolveAccount(request);
  if (!account) {
    return { ok: false, status: 401, error: 'Sign in first.' };
  }

  const id = sessionIdFrom(request, body);
  const session = id ? getSession(account.id, id) : currentSession(account.id);

  if (!session) {
    return {
      ok: false,
      status: 404,
      error: id
        ? 'That sandbox is not running. Start a new build.'
        : 'No sandbox is running. Start a build first.',
    };
  }

  return { ok: true, session, accountId: account.id };
}

/**
 * Opens a session for a newly created sandbox, refusing when the account is
 * already at its plan's concurrency limit.
 *
 * This is the point where `concurrentSandboxes` stops being a number in a
 * pricing table and starts being enforced.
 */
export async function beginSession(
  request: NextRequest,
  sandboxId: string,
  projectId?: string,
): Promise<SessionLookup> {
  const account = await resolveAccount(request);
  if (!account) {
    return { ok: false, status: 401, error: 'Sign in first.' };
  }

  const plan = getPlan(account.planId);
  const limit = plan.limits.concurrentSandboxes;

  // Reopening an id the account already holds is a restart, not a new
  // sandbox, so it must not be counted against the limit.
  const reopening = getSession(account.id, sandboxId) !== null;

  if (!reopening && Number.isFinite(limit) && countSessions(account.id) >= limit) {
    return {
      ok: false,
      status: 409,
      error:
        `The ${plan.name} plan allows ${limit} sandbox${limit === 1 ? '' : 'es'} at once. ` +
        'Close one, or upgrade for more.',
    };
  }

  return {
    ok: true,
    accountId: account.id,
    session: openSession({ accountId: account.id, sandboxId, projectId }),
  };
}
