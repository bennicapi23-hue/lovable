import { NextResponse } from 'next/server';
import { inspectEnv } from '@/lib/env';
import { brand } from '@/config/brand.config';

export const dynamic = 'force-dynamic';

/**
 * GET /api/status
 *
 * Readiness of this deployment. Used by the studio to explain a missing
 * capability before the user hits it, and by uptime checks.
 *
 * Deliberately reports which capabilities are configured, never the values
 * that configure them — no key material, present or absent, is echoed.
 */
export async function GET() {
  const report = inspectEnv();

  return NextResponse.json(
    {
      product: brand.name,
      ready: report.ready,
      features: report.features,
      sandboxProvider: report.sandboxProvider,
      modelProviders: report.aiProviders,
      issues: report.issues.map(({ key, level, message, fix, feature }) => ({
        key,
        level,
        message,
        fix,
        feature,
      })),
    },
    { status: report.ready ? 200 : 503 },
  );
}
