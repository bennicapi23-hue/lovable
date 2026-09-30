import { NextRequest, NextResponse } from 'next/server';
import { resolveAccount } from '@/lib/billing/session';
import {
  clearConversation,
  getConversation,
  newConversation,
  setConversation,
} from '@/lib/sandbox/session-store';

export const dynamic = 'force-dynamic';

/**
 * The chat transcript for the signed-in account.
 *
 * Previously a single process global, so two people using one instance shared
 * one conversation — each seeing the other's messages as context for their
 * own build. Keyed by account it is per-person, and it deliberately does not
 * require a sandbox: the studio clears old history on mount, before anything
 * has been built.
 */

async function accountOr401(request: NextRequest) {
  const account = await resolveAccount(request);
  if (!account) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Sign in first.' },
        { status: 401 },
      ),
    };
  }
  return { account };
}

/** GET: the current conversation, or null. */
export async function GET(request: NextRequest) {
  const { account, error } = await accountOr401(request);
  if (error) return error;

  const state = getConversation(account.id);
  return NextResponse.json({
    success: true,
    state,
    ...(state ? {} : { message: 'No active conversation' }),
  });
}

/** POST: reset, trim, or update the conversation. */
export async function POST(request: NextRequest) {
  const { account, error } = await accountOr401(request);
  if (error) return error;

  try {
    const { action, data } = await request.json();

    switch (action) {
      case 'reset': {
        const state = newConversation();
        setConversation(account.id, state);
        console.log('[conversation-state] reset');
        return NextResponse.json({ success: true, message: 'Conversation state reset', state });
      }

      case 'clear-old': {
        const existing = getConversation(account.id);
        if (!existing) {
          const state = newConversation();
          setConversation(account.id, state);
          return NextResponse.json({
            success: true,
            message: 'New conversation state initialized',
            state,
          });
        }

        // Keep a short tail: enough for continuity, not enough to blow the
        // context window on the next generation.
        existing.context.messages = existing.context.messages.slice(-5);
        existing.context.edits = existing.context.edits.slice(-3);
        existing.context.projectEvolution.majorChanges =
          existing.context.projectEvolution.majorChanges.slice(-2);
        existing.lastUpdated = Date.now();
        setConversation(account.id, existing);

        return NextResponse.json({
          success: true,
          message: 'Old conversation data cleared',
          state: existing,
        });
      }

      case 'update': {
        const existing = getConversation(account.id);
        if (!existing) {
          return NextResponse.json(
            { success: false, error: 'No active conversation to update' },
            { status: 400 },
          );
        }

        if (data?.currentTopic) {
          existing.context.currentTopic = data.currentTopic;
        }
        if (data?.userPreferences) {
          existing.context.userPreferences = {
            ...existing.context.userPreferences,
            ...data.userPreferences,
          };
        }
        existing.lastUpdated = Date.now();
        setConversation(account.id, existing);

        return NextResponse.json({
          success: true,
          message: 'Conversation state updated',
          state: existing,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use "reset", "clear-old" or "update".' },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('[conversation-state] Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}

/** DELETE: drop the conversation entirely. */
export async function DELETE(request: NextRequest) {
  const { account, error } = await accountOr401(request);
  if (error) return error;

  clearConversation(account.id);
  return NextResponse.json({ success: true, message: 'Conversation state cleared' });
}
