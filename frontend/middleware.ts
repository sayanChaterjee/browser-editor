import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { contentSecurityPolicy, createNonce } from './lib/csp';

// CSP_REPORT_ONLY=true reports violations (to /api/csp-report) without blocking anything
const CSP_HEADER = process.env.CSP_REPORT_ONLY === 'true'
  ? 'Content-Security-Policy-Report-Only'
  : 'Content-Security-Policy';

/**
 * Next.js Middleware for Frontend Route Protection
 *
 * This middleware handles authentication-based redirects for frontend routes, and gives
 * every page a Content-Security-Policy with a fresh nonce (Next.js reads the nonce from the
 * request's CSP header and adds it to its scripts).
 *
 * Note: API route proxying is handled by /app/api/[...proxy]/route.ts
 * because middleware rewrites cannot modify headers for external URLs.
 */
// Signed-in page loads start any sleeping backend services right away (free-tier cold starts),
// in parallel, before the page's own requests; at most once a minute per browser
const WAKE_COOKIE = 'ce_woke';
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL;

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  // Check for session cookie to determine if user is authenticated
  const sessionToken =
    request.cookies.get('better-auth.session_token')?.value ||
    request.cookies.get('__Secure-better-auth.session_token')?.value;

  const isPublicPath =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/register';

  // Redirect to login if no session and trying to access protected routes
  if (!sessionToken && !isPublicPath) {
    console.log('[Middleware] No session, redirecting to login from:', pathname);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect to editor if has session and on public auth pages
  if (sessionToken && isPublicPath && pathname !== '/') {
    console.log('[Middleware] Has session, redirecting to editor from:', pathname);
    return NextResponse.redirect(new URL('/practice', request.url));
  }

  const nonce = createNonce();
  const policy = contentSecurityPolicy(nonce, { dev: process.env.NODE_ENV === 'development' });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(CSP_HEADER, policy);

  const prefetch = request.headers.get('next-router-prefetch') || request.headers.get('purpose') === 'prefetch';
  if (sessionToken && BACKEND_URL && !prefetch && !request.cookies.get(WAKE_COOKIE)) {
    // Fire and forget: the gateway pings every service and answers at once
    event.waitUntil(fetch(`${BACKEND_URL}/api/wake`, { cache: 'no-store' }).then(() => undefined, () => undefined));
    response.cookies.set(WAKE_COOKIE, '1', { maxAge: 60, httpOnly: true, sameSite: 'lax', path: '/' });
  }
  return response;
}

export const config = {
  matcher: [
    '/editor/:path*',
    '/practice/:path*',
    '/contests/:path*',
    '/login',
    '/register',
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};