import { NextRequest, NextResponse } from 'next/server';
import { SandboxFactory } from '@/lib/sandbox/factory';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { resolveAccount } from '@/lib/billing/session';
import { getPlan } from '@/config/plans.config';
import { closeAllSessions, countSessions, openSession } from '@/lib/sandbox/session-store';

/**
 * Creates a sandbox through the provider abstraction.
 *
 * This route previously began by calling `sandboxManager.terminateAll()`,
 * which stopped every sandbox in the process — so one person starting a build
 * killed everyone else's running preview. It now stops only the sandboxes the
 * calling account owns.
 */
export async function POST(request: NextRequest) {
  const account = await resolveAccount(request);
  if (!account) {
    return NextResponse.json({ error: 'Sign in to start a sandbox.' }, { status: 401 });
  }

  const plan = getPlan(account.planId);
  const limit = plan.limits.concurrentSandboxes;

  try {
    console.log('[create-ai-sandbox-v2] Creating sandbox...');

    // Retire this account's own sandboxes, and nobody else's.
    for (const stale of closeAllSessions(account.id)) {
      if (!stale.provider) continue;
      try {
        await stale.provider.terminate();
      } catch (e) {
        console.error('[create-ai-sandbox-v2] failed to stop a previous sandbox:', e);
      }
      await sandboxManager.terminateSandbox(stale.id).catch(() => {});
    }

    if (Number.isFinite(limit) && countSessions(account.id) >= limit) {
      return NextResponse.json(
        {
          error:
            `The ${plan.name} plan allows ${limit} sandbox${limit === 1 ? '' : 'es'} at once. ` +
            'Close one, or upgrade for more.',
          upgrade: '/pricing',
        },
        { status: 409 },
      );
    }

    const provider = SandboxFactory.create();
    const sandboxInfo = await provider.createSandbox();

    console.log('[create-ai-sandbox-v2] Setting up Vite React app...');
    await provider.setupViteApp();

    sandboxManager.registerSandbox(sandboxInfo.sandboxId, provider);

    const session = openSession({ accountId: account.id, sandboxId: sandboxInfo.sandboxId });
    session.provider = provider;
    session.sandbox = provider;
    session.data = { sandboxId: sandboxInfo.sandboxId, url: sandboxInfo.url };
    session.state = {
      fileCache: {
        files: {},
        lastSync: Date.now(),
        sandboxId: sandboxInfo.sandboxId,
      },
      sandbox: provider,
      sandboxData: {
        sandboxId: sandboxInfo.sandboxId,
        url: sandboxInfo.url,
      },
    };

    console.log('[create-ai-sandbox-v2] Sandbox ready at:', sandboxInfo.url);

    return NextResponse.json({
      success: true,
      sandboxId: sandboxInfo.sandboxId,
      url: sandboxInfo.url,
      provider: sandboxInfo.provider,
      message: 'Sandbox created and Vite React app initialized',
    });
  } catch (error) {
    console.error('[create-ai-sandbox-v2] Error:', error);

    // Clean up only what this account owns.
    for (const stale of closeAllSessions(account.id)) {
      try {
        await stale.provider?.terminate();
      } catch (e) {
        console.error('[create-ai-sandbox-v2] cleanup failed:', e);
      }
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create sandbox',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
