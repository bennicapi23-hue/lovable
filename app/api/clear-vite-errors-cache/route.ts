import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/sandbox/session-context';

declare global {
  var viteErrorsCache: { errors: any[], timestamp: number } | null;
}

export async function POST(request: NextRequest) {
  const lookup = await requireSession(request);
  if (!lookup.ok) {
    return NextResponse.json({ success: false, error: lookup.error }, { status: lookup.status });
  }
  const { session } = lookup;
  try {
    // Clear the cache
    session.viteErrors = [];
    
    console.log('[clear-vite-errors-cache] Cache cleared');
    
    return NextResponse.json({
      success: true,
      message: 'Vite errors cache cleared'
    });
    
  } catch (error) {
    console.error('[clear-vite-errors-cache] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}