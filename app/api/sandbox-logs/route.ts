import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/sandbox/session-context';

declare global {
  var activeSandbox: any;
}

export async function GET(request: NextRequest) {
  const lookup = await requireSession(request);
  if (!lookup.ok) {
    return NextResponse.json({ success: false, error: lookup.error }, { status: lookup.status });
  }
  const { session } = lookup;
  try {
    if (!session.sandbox) {
      return NextResponse.json({ 
        success: false, 
        error: 'No active sandbox' 
      }, { status: 400 });
    }
    
    console.log('[sandbox-logs] Fetching Vite dev server logs...');
    
    // Check if Vite processes are running
    const psResult = await session.sandbox.runCommand({
      cmd: 'ps',
      args: ['aux']
    });
    
    let viteRunning = false;
    const logContent: string[] = [];
    
    if (psResult.exitCode === 0) {
      const psOutput = await psResult.stdout();
      const viteProcesses = psOutput.split('\n').filter((line: string) => 
        line.toLowerCase().includes('vite') || 
        line.toLowerCase().includes('npm run dev')
      );
      
      viteRunning = viteProcesses.length > 0;
      
      if (viteRunning) {
        logContent.push("Vite is running");
        logContent.push(...viteProcesses.slice(0, 3)); // Show first 3 processes
      } else {
        logContent.push("Vite process not found");
      }
    }
    
    // Try to read any recent log files
    try {
      const findResult = await session.sandbox.runCommand({
        cmd: 'find',
        args: ['/tmp', '-name', '*vite*', '-name', '*.log', '-type', 'f']
      });
      
      if (findResult.exitCode === 0) {
        const logFiles = (await findResult.stdout()).split('\n').filter((f: string) => f.trim());
        
        for (const logFile of logFiles.slice(0, 2)) {
          try {
            const catResult = await session.sandbox.runCommand({
              cmd: 'tail',
              args: ['-n', '10', logFile]
            });
            
            if (catResult.exitCode === 0) {
              const logFileContent = await catResult.stdout();
              logContent.push(`--- ${logFile} ---`);
              logContent.push(logFileContent);
            }
          } catch {
            // Skip if can't read log file
          }
        }
      }
    } catch {
      // No log files found, that's OK
    }
    
    return NextResponse.json({
      success: true,
      hasErrors: false,
      logs: logContent,
      status: viteRunning ? 'running' : 'stopped'
    });
    
  } catch (error) {
    console.error('[sandbox-logs] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}