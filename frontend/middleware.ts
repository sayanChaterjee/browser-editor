import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check for both possible cookie names (with and without __Secure- prefix)
  const sessionToken =
    request.cookies.get('better-auth.session_token')?.value ||
    request.cookies.get('__Secure-better-auth.session_token')?.value;

  const { pathname } = request.nextUrl;

  const isPublicPath =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/register';

  // Don't redirect if user has a session and is trying to access protected routes
  if (!sessionToken && !isPublicPath) {
    console.log('[Middleware] No session, redirecting to login from:', pathname);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If user has session and is on public path, redirect to editor
  if (sessionToken && isPublicPath && pathname !== '/') {
    console.log('[Middleware] Has session, redirecting to editor from:', pathname);
    return NextResponse.redirect(new URL('/editor', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/editor/:path*', '/login', '/register',
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};