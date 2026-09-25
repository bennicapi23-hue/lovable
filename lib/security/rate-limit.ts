import type { NextRequest } from 'next/server';

/**
 * In-process rate limiting.
 *
 * Deliberately simple: a fixed window per (bucket, client) held in memory.
 * That is the right trade-off for a single instance and for local runs, and
 * it stops the obvious abuse — someone hammering the generation endpoints and
 * burning the operator's model credits.
 *
 * It is NOT sufficient across a horizontally scaled deployment, because each
 * instance keeps its own counters. Set KILN_RATE_LIMIT_BACKEND=redis and
 * supply a shared store before scaling past one instance; until then the
 * limiter reports its own scope honestly via the X-RateLimit-Scope header.
 */

export interface RateLimitOptions {
  /** Namespace, so unrelated endpoints do not share a budget. */
  bucket: string;
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  headers: Record<string, string>;
}

interface Counter {
  count: number;
  resetAt: number;
}

const counters = new Map<string, Counter>();

/** Stop the map growing without bound on a long-lived server. */
function sweep(now: number): void {
  if (counters.size < 5_000) return;
  for (const [key, counter] of counters) {
    if (counter.resetAt <= now) counters.delete(key);
  }
}

/**
 * Identifies the caller. Behind a proxy the socket address is the proxy, so
 * the forwarded headers are used when present. These headers are spoofable by
 * a direct client, which is acceptable here: this is an abuse speed bump, not
 * an authentication boundary.
 */
export function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return (
    request.headers.get('x-real-ip') ??
    request.headers.get('cf-connecting-ip') ??
    'local'
  );
}

export async function rateLimit(
  request: NextRequest,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = Date.now();
  sweep(now);

  const key = `${options.bucket}:${clientKey(request)}`;
  const existing = counters.get(key);

  const counter =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + options.windowMs };

  counter.count += 1;
  counters.set(key, counter);

  const remaining = Math.max(0, options.limit - counter.count);
  const ok = counter.count <= options.limit;

  return {
    ok,
    remaining,
    resetAt: counter.resetAt,
    headers: {
      'X-RateLimit-Limit': String(options.limit),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(Math.ceil(counter.resetAt / 1000)),
      'X-RateLimit-Scope': 'instance',
      ...(ok ? {} : { 'Retry-After': String(Math.ceil((counter.resetAt - now) / 1000)) }),
    },
  };
}

/** Test seam: drops all counters. */
export function __resetRateLimits(): void {
  counters.clear();
}
