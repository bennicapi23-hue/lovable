import type { SandboxState } from '@/types/sandbox';
import type { ConversationState } from '@/types/conversation';
import type { SandboxProvider } from './types';

/**
 * A provider's own sandbox object.
 *
 * E2B and Vercel return unrelated shapes and neither ships a shared type, so
 * this stays deliberately loose rather than pretending to a structure that
 * does not exist. Our own wrapper below *is* typed: prefer `session.provider`
 * over `session.sandbox` in new code.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SandboxHandle = any;

/**
 * Build sessions, keyed by the account that owns them.
 *
 * Upstream kept all of this in process globals — `global.activeSandbox`,
 * `global.conversationState` and three others. That is fine for one person on
 * one laptop and wrong the moment two people use the same instance: the
 * second person's build overwrites the first's sandbox handle, and the first
 * starts writing files into a container they no longer own.
 *
 * Keying by account fixes the cross-user collision, which is the actual bug.
 * One account may hold several sessions, up to the `concurrentSandboxes`
 * limit its plan already declares in config/plans.config.ts — so the limit
 * becomes enforceable rather than decorative.
 *
 * Still in-process: a session holds a live sandbox SDK object, which cannot be
 * serialised into a shared store. Horizontal scaling therefore needs sticky
 * routing by account, or a sandbox service that hands back reconnectable
 * handles. That is a deployment decision, not a code one, and it is recorded
 * in docs/ROADMAP.md.
 */

export interface BuildSession {
  /** Sandbox id, and the session's own identity. */
  id: string;
  /** Account that owns it. Nobody else may resolve this session. */
  accountId: string;
  /** Project being built, when the build came from a saved project. */
  projectId?: string;

  /** Live provider SDK object. Not serialisable. */
  sandbox: SandboxHandle;
  /** Our own provider wrapper — typed, and the one to reach for. */
  provider: SandboxProvider | null;
  /** Connection details handed to the preview iframe. */
  data: { sandboxId: string; url: string } | null;
  /** Paths written so far, so a rebuild knows what already exists. */
  existingFiles: Set<string>;
  /** File cache and sandbox handle, in upstream's shape. */
  state: SandboxState;

  /* --- dev-server bookkeeping ------------------------------------------
     Per session, not per process: one account's restart cooldown must not
     block another's, and one build's error buffer is not another's. */

  /** Guards against two restarts racing in the same sandbox. */
  viteRestartInProgress: boolean;
  /** Epoch ms of the last restart, for the cooldown. */
  lastViteRestartAt: number | null;
  /** Recent dev-server errors, newest last. Capped by the route that writes it. */
  viteErrors: unknown[];

  createdAt: number;
  lastUsedAt: number;
}

/** Sessions idle longer than this are dropped; their sandbox is already gone. */
const IDLE_TTL_MS = 60 * 60 * 1000;

const sessions = new Map<string, BuildSession>();

function compositeKey(accountId: string, sessionId: string): string {
  return `${accountId}:${sessionId}`;
}

/** Drops sessions whose sandbox has certainly expired. */
function sweep(now: number): void {
  for (const [key, session] of sessions) {
    if (now - session.lastUsedAt > IDLE_TTL_MS) sessions.delete(key);
  }
}

function emptyState(): SandboxState {
  return { fileCache: null, sandbox: null, sandboxData: null };
}

/**
 * Creates a session for a new sandbox.
 *
 * Replaces any session this account already had under the same sandbox id,
 * which is what happens when a sandbox is recreated after a crash.
 */
export function openSession(input: {
  accountId: string;
  sandboxId: string;
  projectId?: string;
}): BuildSession {
  const now = Date.now();
  sweep(now);

  const session: BuildSession = {
    id: input.sandboxId,
    accountId: input.accountId,
    projectId: input.projectId,
    sandbox: null,
    provider: null,
    data: null,
    existingFiles: new Set<string>(),
    state: emptyState(),
    viteRestartInProgress: false,
    lastViteRestartAt: null,
    viteErrors: [],
    createdAt: now,
    lastUsedAt: now,
  };

  sessions.set(compositeKey(input.accountId, input.sandboxId), session);
  return session;
}

/**
 * Looks up a session.
 *
 * Ownership is part of the key rather than a check afterwards, so there is no
 * path where a session is fetched and the check is forgotten. A session id
 * belonging to another account simply does not resolve.
 */
export function getSession(accountId: string, sessionId: string): BuildSession | null {
  const session = sessions.get(compositeKey(accountId, sessionId));
  if (!session) return null;
  session.lastUsedAt = Date.now();
  return session;
}

/**
 * The account's most recently used session.
 *
 * Several inherited routes act on "the current sandbox" without naming one.
 * Scoped to the account this is well defined and safe; across accounts it
 * never was.
 */
export function currentSession(accountId: string): BuildSession | null {
  let newest: BuildSession | null = null;
  for (const session of sessions.values()) {
    if (session.accountId !== accountId) continue;
    if (!newest || session.lastUsedAt > newest.lastUsedAt) newest = session;
  }
  if (newest) newest.lastUsedAt = Date.now();
  return newest;
}

/** Sessions belonging to an account, newest first. */
export function listSessions(accountId: string): BuildSession[] {
  return [...sessions.values()]
    .filter((s) => s.accountId === accountId)
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

/** How many live sandboxes this account holds, for the plan limit. */
export function countSessions(accountId: string): number {
  sweep(Date.now());
  return listSessions(accountId).length;
}

/** Closes a session. Terminating the sandbox itself is the caller's job. */
export function closeSession(accountId: string, sessionId: string): void {
  sessions.delete(compositeKey(accountId, sessionId));
}

/** Closes every session for an account. */
export function closeAllSessions(accountId: string): BuildSession[] {
  const closed = listSessions(accountId);
  for (const session of closed) {
    sessions.delete(compositeKey(accountId, session.id));
  }
  return closed;
}

/* ------------------------------------------------------------ conversation */

/**
 * Chat history, keyed by account rather than by session.
 *
 * A conversation starts before any sandbox exists — the studio clears old
 * history on mount, well before the first build — and outlives the sandbox it
 * ran in. Tying it to a session would mean losing the transcript every time a
 * sandbox is recycled, which is exactly when the user most wants it.
 */
const conversations = new Map<string, ConversationState>();

export function getConversation(accountId: string): ConversationState | null {
  return conversations.get(accountId) ?? null;
}

export function setConversation(accountId: string, state: ConversationState): void {
  conversations.set(accountId, state);
}

export function clearConversation(accountId: string): void {
  conversations.delete(accountId);
}

/** A fresh, empty conversation. */
export function newConversation(): ConversationState {
  return {
    conversationId: `conv-${Date.now()}`,
    startedAt: Date.now(),
    lastUpdated: Date.now(),
    context: {
      messages: [],
      edits: [],
      projectEvolution: { majorChanges: [] },
      userPreferences: {},
    },
  };
}

/** Test seam. */
export function __resetSessions(): void {
  sessions.clear();
  conversations.clear();
}

/** Diagnostics for an operations endpoint. Deliberately carries no handles. */
export function sessionStats(): { total: number; accounts: number; oldestMs: number | null } {
  const now = Date.now();
  const accounts = new Set<string>();
  let oldest: number | null = null;

  for (const session of sessions.values()) {
    accounts.add(session.accountId);
    const age = now - session.createdAt;
    if (oldest === null || age > oldest) oldest = age;
  }

  return { total: sessions.size, accounts: accounts.size, oldestMs: oldest };
}
