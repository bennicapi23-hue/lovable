import { NextRequest, NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { requireSession } from '@/lib/sandbox/session-context';

declare global {
  var activeSandboxProvider: any;
  var sandboxData: any;
  var existingFiles: Set<string>;
}

export async function GET(request: NextRequest) {
  const lookup = await requireSession(request);
  if (!lookup.ok) {
    return NextResponse.json({ success: false, error: lookup.error }, { status: lookup.status });
  }
  const { session } = lookup;
  try {
    // Check sandbox manager first, then fall back to global state
    const provider = sandboxManager.getActiveProvider() || session.provider;
    const sandboxExists = !!provider;

    let sandboxHealthy = false;
    let sandboxInfo = null;

    if (sandboxExists && provider) {
      try {
        // Check if sandbox is healthy by getting its info
        const providerInfo = provider.getSandboxInfo();
        sandboxHealthy = !!providerInfo;
        
        sandboxInfo = {
          sandboxId: providerInfo?.sandboxId || session.data?.sandboxId,
          url: providerInfo?.url || session.data?.url,
          filesTracked: session.existingFiles ? Array.from(session.existingFiles) : [],
          lastHealthCheck: new Date().toISOString()
        };
      } catch (error) {
        console.error('[sandbox-status] Health check failed:', error);
        sandboxHealthy = false;
      }
    }
    
    return NextResponse.json({
      success: true,
      active: sandboxExists,
      healthy: sandboxHealthy,
      sandboxData: sandboxInfo,
      message: sandboxHealthy 
        ? 'Sandbox is active and healthy' 
        : sandboxExists 
          ? 'Sandbox exists but is not responding' 
          : 'No active sandbox'
    });
    
  } catch (error) {
    console.error('[sandbox-status] Error:', error);
    return NextResponse.json({ 
      success: false,
      active: false,
      error: (error as Error).message 
    }, { status: 500 });
  }
}