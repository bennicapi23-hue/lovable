import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  closeAllSessions,
  closeSession,
  countSessions,
  currentSession,
  getConversation,
  getSession,
  listSessions,
  newConversation,
  openSession,
  sessionStats,
  setConversation,
  clearConversation,
  __resetSessions,
} from '@/lib/sandbox/session-store.ts';

/**
 * These tests encode the bug the store exists to fix: upstream kept the
 * sandbox in a process global, so two accounts on one instance overwrote each
 * other. Every assertion below fails against that design.
 */

const alice = 'acct-alice';
const bob = 'acct-bob';

describe('build sessions', () => {
  beforeEach(() => __resetSessions());

  test('two accounts can hold sandboxes at the same time', () => {
    openSession({ accountId: alice, sandboxId: 'sbx-a' });
    openSession({ accountId: bob, sandboxId: 'sbx-b' });

    assert.equal(getSession(alice, 'sbx-a')?.id, 'sbx-a');
    assert.equal(getSession(bob, 'sbx-b')?.id, 'sbx-b');
  });

  test('one account cannot resolve another account’s sandbox', () => {
    openSession({ accountId: alice, sandboxId: 'sbx-a' });
    // Reads as absent rather than forbidden, so the id is not confirmed.
    assert.equal(getSession(bob, 'sbx-a'), null);
  });

  test('starting a sandbox does not disturb another account', () => {
    const a = openSession({ accountId: alice, sandboxId: 'sbx-a' });
    a.sandbox = { mine: true };

    openSession({ accountId: bob, sandboxId: 'sbx-b' });

    assert.deepEqual(getSession(alice, 'sbx-a')?.sandbox, { mine: true },
      'bob starting a build must not touch alice’s sandbox');
  });

  test('closeAllSessions only closes the caller’s', () => {
    openSession({ accountId: alice, sandboxId: 'sbx-a1' });
    openSession({ accountId: alice, sandboxId: 'sbx-a2' });
    openSession({ accountId: bob, sandboxId: 'sbx-b' });

    const closed = closeAllSessions(alice);

    assert.equal(closed.length, 2);
    assert.equal(countSessions(alice), 0);
    assert.equal(countSessions(bob), 1, 'bob’s sandbox must survive');
  });

  test('currentSession is the account’s most recently used one', () => {
    openSession({ accountId: alice, sandboxId: 'old' });
    const recent = openSession({ accountId: alice, sandboxId: 'new' });
    recent.lastUsedAt = Date.now() + 1000;

    assert.equal(currentSession(alice)?.id, 'new');
    assert.equal(currentSession(bob), null, 'an account with no sandbox has no current session');
  });

  test('countSessions is what makes the plan limit enforceable', () => {
    assert.equal(countSessions(alice), 0);
    openSession({ accountId: alice, sandboxId: 's1' });
    openSession({ accountId: alice, sandboxId: 's2' });
    assert.equal(countSessions(alice), 2);
    assert.equal(countSessions(bob), 0);
  });

  test('reopening the same id replaces rather than accumulates', () => {
    openSession({ accountId: alice, sandboxId: 'same' });
    openSession({ accountId: alice, sandboxId: 'same' });
    assert.equal(countSessions(alice), 1);
  });

  test('a session starts empty', () => {
    const session = openSession({ accountId: alice, sandboxId: 'fresh' });
    assert.equal(session.sandbox, null);
    assert.equal(session.provider, null);
    assert.equal(session.data, null);
    assert.equal(session.existingFiles.size, 0);
    assert.equal(session.viteRestartInProgress, false);
    assert.deepEqual(session.viteErrors, []);
  });

  test('dev-server bookkeeping is per session, not per process', () => {
    const a = openSession({ accountId: alice, sandboxId: 'sbx-a' });
    const b = openSession({ accountId: bob, sandboxId: 'sbx-b' });

    a.viteRestartInProgress = true;
    a.viteErrors.push({ message: 'alice only' });

    assert.equal(b.viteRestartInProgress, false,
      'alice restarting must not block bob');
    assert.equal(b.viteErrors.length, 0,
      'alice’s build errors must not appear in bob’s');
  });

  test('closeSession removes one and leaves the rest', () => {
    openSession({ accountId: alice, sandboxId: 's1' });
    openSession({ accountId: alice, sandboxId: 's2' });
    closeSession(alice, 's1');
    assert.equal(getSession(alice, 's1'), null);
    assert.equal(getSession(alice, 's2')?.id, 's2');
  });

  test('listSessions is newest first and scoped to the account', () => {
    const first = openSession({ accountId: alice, sandboxId: 'first' });
    const second = openSession({ accountId: alice, sandboxId: 'second' });
    openSession({ accountId: bob, sandboxId: 'bob' });
    first.lastUsedAt = 1;
    second.lastUsedAt = 2;

    assert.deepEqual(listSessions(alice).map((s) => s.id), ['second', 'first']);
  });

  test('stats carry counts, never handles', () => {
    openSession({ accountId: alice, sandboxId: 's1' }).sandbox = { secret: 'token' };
    openSession({ accountId: bob, sandboxId: 's2' });

    const stats = sessionStats();
    assert.equal(stats.total, 2);
    assert.equal(stats.accounts, 2);
    assert.ok(!JSON.stringify(stats).includes('secret'));
  });
});

describe('conversations', () => {
  beforeEach(() => __resetSessions());

  test('are per account', () => {
    setConversation(alice, newConversation());
    assert.ok(getConversation(alice));
    assert.equal(getConversation(bob), null,
      'two people on one instance must not share a transcript');
  });

  test('outlive the sandbox they ran in', () => {
    openSession({ accountId: alice, sandboxId: 'sbx' });
    setConversation(alice, newConversation());
    closeAllSessions(alice);

    assert.ok(getConversation(alice),
      'recycling a sandbox must not lose the chat history');
  });

  test('clear removes only that account’s', () => {
    setConversation(alice, newConversation());
    setConversation(bob, newConversation());
    clearConversation(alice);
    assert.equal(getConversation(alice), null);
    assert.ok(getConversation(bob));
  });

  test('a new conversation is well formed and empty', () => {
    const c = newConversation();
    assert.match(c.conversationId, /^conv-\d+$/);
    assert.deepEqual(c.context.messages, []);
    assert.deepEqual(c.context.edits, []);
    assert.deepEqual(c.context.projectEvolution.majorChanges, []);
  });
});
