import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // Define public paths that don't require authentication
  const isPublicPath = pathname === '/login' || pathname === '/register';

  if (!token && !isPublicPath) {
    // Redirect to login if trying to access a protected route without a token
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && isPublicPath) {
    // Redirect to editor if trying to access login/register while already authenticated
    return NextResponse.redirect(new URL('/editor', request.url));
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/editor/:path*', '/login', '/register',
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};