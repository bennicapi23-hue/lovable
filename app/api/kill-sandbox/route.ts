import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/sandbox/session-context';

declare global {
  var activeSandboxProvider: any;
  var sandboxData: any;
  var existingFiles: Set<string>;
}

export async function POST(request: NextRequest) {
  const lookup = await requireSession(request);
  if (!lookup.ok) {
    return NextResponse.json({ success: false, error: lookup.error }, { status: lookup.status });
  }
  const { session } = lookup;
  try {
    console.log('[kill-sandbox] Stopping active sandbox...');

    let sandboxKilled = false;

    // Stop existing sandbox if any
    if (session.provider) {
      try {
        await session.provider.terminate();
        sandboxKilled = true;
        console.log('[kill-sandbox] Sandbox stopped successfully');
      } catch (e) {
        console.error('[kill-sandbox] Failed to stop sandbox:', e);
      }
      session.provider = null;
      session.data = null;
    }
    
    // Clear existing files tracking
    if (session.existingFiles) {
      session.existingFiles.clear();
    }
    
    return NextResponse.json({
      success: true,
      sandboxKilled,
      message: 'Sandbox cleaned up successfully'
    });
    
  } catch (error) {
    console.error('[kill-sandbox] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: (error as Error).message 
      }, 
      { status: 500 }
    );
  }
}