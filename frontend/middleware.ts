import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get('better-auth.session_token')?.value;
  const { pathname } = request.nextUrl;

  const isPublicPath =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/register';

  if (!sessionToken && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (sessionToken && isPublicPath) {
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