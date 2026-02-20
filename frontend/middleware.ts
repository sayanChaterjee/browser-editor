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

  // Check for session cookie to determine if user is authenticated
  const sessionToken =
    request.cookies.get('better-auth.session_token')?.value ||
    request.cookies.get('__Secure-better-auth.session_token')?.value;

  const isPublicPath =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/admin';

  // Redirect to login if no session and trying to access protected routes
  if (!sessionToken && !isPublicPath) {
    console.log('[Middleware] No session, redirecting to login from:', pathname);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect to editor if has session and on public auth pages
  if (sessionToken && isPublicPath && pathname !== '/') {
    console.log('[Middleware] Has session, redirecting to editor from:', pathname);
    return NextResponse.redirect(new URL('/editor', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/editor/:path*', '/login', '/register',  // Match frontend routes for auth redirects
    '/((?!api|_next/static|_next/image|favicon.ico).*)',  // Match all other routes except API and static files
  ],
};