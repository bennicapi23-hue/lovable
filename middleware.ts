import { NextResponse, type NextRequest } from 'next/server';

/**
 * Route protection.
 *
 * Only checks for the presence of a session cookie — it does not verify it.
 * Verification needs the Auth.js runtime, which is heavier than middleware
 * should be on every request, and the real enforcement lives in the route
 * handlers and server components that actually read the session.
 *
 * So this is a redirect for convenience, not a security boundary: it saves a
 * signed-out visitor from loading an app shell that will refuse them anyway.
 * A forged cookie gets past here and is then rejected downstream.
 */

const PROTECTED = ['/create', '/generation', '/projects', '/account'];

/** Auth.js names the cookie differently over https. */
const SESSION_COOKIES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!PROTECTED.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return NextResponse.next();
  }

  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession) return NextResponse.next();

  const signIn = new URL('/sign-in', request.url);
  signIn.searchParams.set('callbackUrl', pathname + request.nextUrl.search);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ['/create/:path*', '/generation/:path*', '/projects/:path*', '/account/:path*'],
};
