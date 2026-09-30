import { NextRequest, NextResponse } from 'next/server';
import { Sandbox } from '@vercel/sandbox';
import { appConfig } from '@/config/app.config';
import { resolveAccount } from '@/lib/billing/session';
import { getPlan } from '@/config/plans.config';
import {
  closeAllSessions,
  countSessions,
  currentSession,
  openSession,
} from '@/lib/sandbox/session-store';

/**
 * In-flight creations, per account.
 *
 * Two clicks on "new sandbox" used to share one process-wide promise, so a
 * second account could be handed the first account's sandbox. Keying the
 * promise by account keeps the de-duplication without the leak.
 */
const creating = new Map<string, Promise<any>>();

export async function POST(request: NextRequest) {
  const account = await resolveAccount(request);
  if (!account) {
    return NextResponse.json({ error: 'Sign in to start a sandbox.' }, { status: 401 });
  }

  // Someone already asked for this account's sandbox and it is still coming.
  const inFlight = creating.get(account.id);
  if (inFlight) {
    console.log('[create-ai-sandbox] creation already in progress for this account');
    try {
      return NextResponse.json(await inFlight);
    } catch {
      // That attempt failed; fall through and try again.
    }
  }

  // Reuse a sandbox this account already has running.
  const existing = currentSession(account.id);
  if (existing?.sandbox && existing.data) {
    console.log('[create-ai-sandbox] reusing this account running sandbox');
    return NextResponse.json({
      success: true,
      sandboxId: existing.data.sandboxId,
      url: existing.data.url,
    });
  }

  // Enforce the concurrency the plan advertises.
  const plan = getPlan(account.planId);
  const limit = plan.limits.concurrentSandboxes;
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

  const promise = createSandboxInternal(account.id);
  creating.set(account.id, promise);

  try {
    return NextResponse.json(await promise);
  } catch (error) {
    console.error('[create-ai-sandbox] Sandbox creation failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create sandbox',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  } finally {
    creating.delete(account.id);
  }
}

async function createSandboxInternal(accountId: string) {
  let sandbox: any = null;

  try {
    console.log('[create-ai-sandbox] Creating Vercel sandbox...');
    
    // Stop anything this account still has running. Scoped to the account:
    // stopping every sandbox on the process is what broke other users.
    for (const stale of closeAllSessions(accountId)) {
      if (!stale.sandbox) continue;
      console.log('[create-ai-sandbox] stopping this account previous sandbox');
      try {
        await stale.sandbox.stop();
      } catch (e) {
        console.error('Failed to stop existing sandbox:', e);
      }
    }

    // Create Vercel sandbox with flexible authentication
    console.log(`[create-ai-sandbox] Creating Vercel sandbox with ${appConfig.vercelSandbox.timeoutMinutes} minute timeout...`);
    
    // Prepare sandbox configuration
    const sandboxConfig: any = {
      timeout: appConfig.vercelSandbox.timeoutMs,
      runtime: appConfig.vercelSandbox.runtime,
      ports: [appConfig.vercelSandbox.devPort]
    };
    
    // Add authentication parameters if using personal access token
    if (process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID) {
      console.log('[create-ai-sandbox] Using personal access token authentication');
      sandboxConfig.teamId = process.env.VERCEL_TEAM_ID;
      sandboxConfig.projectId = process.env.VERCEL_PROJECT_ID;
      sandboxConfig.token = process.env.VERCEL_TOKEN;
    } else if (process.env.VERCEL_OIDC_TOKEN) {
      console.log('[create-ai-sandbox] Using OIDC token authentication');
    } else {
      console.log('[create-ai-sandbox] No authentication found - relying on default Vercel authentication');
    }
    
    sandbox = await Sandbox.create(sandboxConfig);
    
    const sandboxId = sandbox.sandboxId;
    console.log(`[create-ai-sandbox] Sandbox created: ${sandboxId}`);

    // Set up a basic Vite React app
    console.log('[create-ai-sandbox] Setting up Vite React app...');
    
    // First, change to the working directory
    await sandbox.runCommand('pwd');
    // workDir is defined in appConfig - not needed here
    
    // Get the sandbox URL using the correct Vercel Sandbox API
    const sandboxUrl = sandbox.domain(appConfig.vercelSandbox.devPort);
    
    // Extract the hostname from the sandbox URL for Vite config
    const sandboxHostname = new URL(sandboxUrl).hostname;
    console.log(`[create-ai-sandbox] Sandbox hostname: ${sandboxHostname}`);

    // Create the Vite config content with the proper hostname (using string concatenation)
    const viteConfigContent = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vercel Sandbox compatible Vite configuration
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: ${appConfig.vercelSandbox.devPort},
    strictPort: true,
    hmr: true,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '` + sandboxHostname + `', // Allow the Vercel Sandbox domain
      '.vercel.run', // Allow all Vercel sandbox domains
      '.vercel-sandbox.dev' // Fallback pattern
    ]
  }
})`;

    // Create the project files (now we have the sandbox hostname)
    const projectFiles = [
      {
        path: 'package.json',
        content: Buffer.from(JSON.stringify({
          "name": "sandbox-app",
          "version": "1.0.0",
          "type": "module",
          "scripts": {
            "dev": "vite --host --port 3000",
            "build": "vite build",
            "preview": "vite preview"
          },
          "dependencies": {
            "react": "^18.2.0",
            "react-dom": "^18.2.0"
          },
          "devDependencies": {
            "@vitejs/plugin-react": "^4.0.0",
            "vite": "^4.3.9",
            "tailwindcss": "^3.3.0",
            "postcss": "^8.4.31",
            "autoprefixer": "^10.4.16"
          }
        }, null, 2))
      },
      {
        path: 'vite.config.js',
        content: Buffer.from(viteConfigContent)
      },
      {
        path: 'tailwind.config.js',
        content: Buffer.from(`/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`)
      },
      {
        path: 'postcss.config.js',
        content: Buffer.from(`export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`)
      },
      {
        path: 'index.html',
        content: Buffer.from(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sandbox App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`)
      },
      {
        path: 'src/main.jsx',
        content: Buffer.from(`import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`)
      },
      {
        path: 'src/App.jsx',
        content: Buffer.from(`function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
          Sandbox Ready
        </h1>
        <p className="text-lg text-gray-400">
          Start building your React app with Vite and Tailwind CSS!
        </p>
      </div>
    </div>
  )
}

export default App`)
      },
      {
        path: 'src/index.css',
        content: Buffer.from(`@tailwind base;
@tailwind components;
@tailwind utilities;

/* Force Tailwind to load */
@layer base {
  :root {
    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    -webkit-text-size-adjust: 100%;
  }
  
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background-color: rgb(17 24 39);
}`)
      }
    ];

    // Create directory structure first
    await sandbox.runCommand({
      cmd: 'mkdir',
      args: ['-p', 'src']
    });
    
    // Write all files
    await sandbox.writeFiles(projectFiles);
    console.log('[create-ai-sandbox] ✓ Project files created');
    
    // Install dependencies
    console.log('[create-ai-sandbox] Installing dependencies...');
    const installResult = await sandbox.runCommand({
      cmd: 'npm',
      args: ['install', '--loglevel', 'info']
    });
    if (installResult.exitCode === 0) {
      console.log('[create-ai-sandbox] ✓ Dependencies installed successfully');
    } else {
      console.log('[create-ai-sandbox] ⚠ Warning: npm install had issues but continuing...');
    }
    
    // Start Vite dev server in detached mode
    console.log('[create-ai-sandbox] Starting Vite dev server...');
    const viteProcess = await sandbox.runCommand({
      cmd: 'npm',
      args: ['run', 'dev'],
      detached: true
    });
    
    console.log('[create-ai-sandbox] ✓ Vite dev server started');
    
    // Wait for Vite to be fully ready
    await new Promise(resolve => setTimeout(resolve, appConfig.vercelSandbox.devServerStartupDelay));

    // Hand the sandbox to a session owned by this account.
    const session = openSession({ accountId, sandboxId });
    session.sandbox = sandbox;
    session.data = { sandboxId, url: sandboxUrl };
    session.state = {
      fileCache: {
        files: {},
        lastSync: Date.now(),
        sandboxId
      },
      sandbox,
      sandboxData: {
        sandboxId,
        url: sandboxUrl
      }
    };

    // Files the scaffold created, so a later build knows they already exist.
    for (const path of [
      'src/App.jsx',
      'src/main.jsx',
      'src/index.css',
      'index.html',
      'package.json',
      'vite.config.js',
      'tailwind.config.js',
      'postcss.config.js',
    ]) {
      session.existingFiles.add(path);
    }

    console.log('[create-ai-sandbox] Sandbox ready at:', sandboxUrl);

    return {
      success: true,
      sandboxId,
      url: sandboxUrl,
      message: 'Vercel sandbox created and Vite React app initialized'
    };

  } catch (error) {
    console.error('[create-ai-sandbox] Error:', error);
    
    // Clean up on error
    if (sandbox) {
      try {
        await sandbox.stop();
      } catch (e) {
        console.error('Failed to stop sandbox on error:', e);
      }
    }
    
    // Drop the half-built session so a retry starts clean.
    closeAllSessions(accountId);

    throw error; // Throw to be caught by the outer handler
  }
}