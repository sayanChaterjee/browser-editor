import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ============================================
  // PART 1: Cookie Forwarding for API Routes
  // ============================================
  // Forward cookies to backend for all /api/* requests
  // This fixes the 401 Unauthorized error by ensuring session cookies reach the backend
  if (pathname.startsWith('/api/')) {
    const backendUrl = `https://api-gateway-rq2x.onrender.com${pathname}${request.nextUrl.search}`;

    // Get all cookies from the browser request
    const cookieHeader = request.headers.get('cookie');

    // Create new headers and explicitly forward the Cookie header
    const headers = new Headers(request.headers);
    if (cookieHeader) {
      headers.set('cookie', cookieHeader);
    }

    // Rewrite the request to the backend with cookies
    return NextResponse.rewrite(new URL(backendUrl), {
      request: {
        headers: headers,
      },
    });
  }

  // ============================================
  // PART 2: Auth Redirects for Frontend Routes
  // ============================================
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
    return NextResponse.redirect(new URL('/editor', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',  // Match all API routes for cookie forwarding
    '/editor/:path*', '/login', '/register',  // Match frontend routes for auth redirects
    '/((?!_next/static|_next/image|favicon.ico).*)',  // Match all other routes except static files
  ],
};