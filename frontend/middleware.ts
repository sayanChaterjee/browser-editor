import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware for Frontend Route Protection
 * 
 * This middleware handles authentication-based redirects for frontend routes.
 * 
 * Note: API route proxying is handled by /app/api/[...proxy]/route.ts
 * because middleware rewrites cannot modify headers for external URLs.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // DEBUG: Log all cookies
  const allCookies = request.cookies.getAll();
  console.log('[Middleware Debug] Path:', pathname);
  console.log('[Middleware Debug] Cookie count:', allCookies.length);
  console.log('[Middleware Debug] Cookie names:', allCookies.map(c => c.name).join(', '));

  // Check for session cookie - try multiple possible names
  // Better-auth might use different cookie names depending on configuration
  const sessionToken =
    request.cookies.get('better-auth.session_token')?.value ||
    request.cookies.get('__Secure-better-auth.session_token')?.value ||
    request.cookies.get('better-auth.session-token')?.value ||  // Alternative format
    request.cookies.get('__Secure-better-auth.session-token')?.value ||
    request.cookies.get('authjs.session-token')?.value ||  // Legacy format
    request.cookies.get('__Secure-authjs.session-token')?.value;

  console.log('[Middleware Debug] Session token found:', !!sessionToken);
  if (!sessionToken && allCookies.length > 0) {
    console.log('[Middleware Debug] ⚠️ Cookies exist but session token not found!');
    console.log('[Middleware Debug] Checked cookie names:', [
      'better-auth.session_token',
      '__Secure-better-auth.session_token',
      'better-auth.session-token',
      '__Secure-better-auth.session-token'
    ].join(', '));
  }

  const isPublicPath =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/callback';  // OAuth callback page

  console.log('[Middleware Debug] Is public path:', isPublicPath);

  // Redirect to login if no session and trying to access protected routes
  if (!sessionToken && !isPublicPath) {
    console.log('[Middleware] ❌ No session token found, redirecting to /login from:', pathname);
    console.log('[Middleware] Available cookies:', allCookies.map(c => c.name).join(', '));
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect to editor if has session and on public auth pages
  if (sessionToken && isPublicPath && pathname !== '/') {
    console.log('[Middleware] ✅ Has session, redirecting to /editor from:', pathname);
    return NextResponse.redirect(new URL('/editor', request.url));
  }

  console.log('[Middleware] ✅ Allowing access to:', pathname);
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/editor/:path*', '/login', '/register', '/callback',  // Match frontend routes for auth redirects
    '/((?!api|_next/static|_next/image|favicon.ico).*)',  // Match all other routes except API and static files
  ],
};