import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL;
// Server-only secret shared with the API gateway: it proves the x-client-ip header below
// comes from this proxy, so the gateway can rate-limit by the real client IP.
const BFF_SHARED_SECRET = process.env.BFF_SHARED_SECRET;
const PROXY_HEADERS = ['x-bff-secret', 'x-client-ip'];

// Vercel sets x-real-ip to the connecting client's address (clients can't override it);
// locally, fall back to the first X-Forwarded-For entry.
function getClientIp(request: NextRequest): string | undefined {
    return request.headers.get('x-real-ip')
        || request.headers.get('x-forwarded-for')?.split(',')[0].trim()
        || undefined;
}

/**
 * API Route Proxy - Catch-all handler for /api/*
 * 
 * This manually proxies all API requests to the Render backend while
 * explicitly forwarding cookies and handling redirects.
 */

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ proxy: string[] }> }
) {
    const resolvedParams = await params;
    return proxyRequest(request, resolvedParams.proxy);
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ proxy: string[] }> }
) {
    const resolvedParams = await params;
    return proxyRequest(request, resolvedParams.proxy);
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ proxy: string[] }> }
) {
    const resolvedParams = await params;
    return proxyRequest(request, resolvedParams.proxy);
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ proxy: string[] }> }
) {
    const resolvedParams = await params;
    return proxyRequest(request, resolvedParams.proxy);
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ proxy: string[] }> }
) {
    const resolvedParams = await params;
    return proxyRequest(request, resolvedParams.proxy);
}

async function proxyRequest(request: NextRequest, pathSegments: string[]) {
    const requestId = Math.random().toString(36).substring(7);
    try {
        if (!BACKEND_URL) {
            throw new Error('NEXT_PUBLIC_API_URL is not defined');
        }

        // Reconstruct the full path
        const path = pathSegments.join('/');
        const searchParams = request.nextUrl.searchParams.toString();
        const backendUrl = `${BACKEND_URL}/api/${path}${searchParams ? `?${searchParams}` : ''}`;

        console.log(`[Proxy][${requestId}] Request: ${request.method} ${backendUrl}`);

        // 1. Build headers to forward to backend
        const headers = new Headers();
        request.headers.forEach((value, key) => {
            // Forward everything except host, connection, and client-supplied proxy headers
            if (!['host', 'connection', ...PROXY_HEADERS].includes(key.toLowerCase())) {
                headers.set(key, value);
            }
        });

        const clientIp = getClientIp(request);
        if (BFF_SHARED_SECRET && clientIp) {
            headers.set('x-bff-secret', BFF_SHARED_SECRET);
            headers.set('x-client-ip', clientIp);
        }

        // 2. Get request body for non-GET requests
        let body: string | undefined;
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            body = await request.text();
        }

        // 3. Make the proxied request
        // CRITICAL: Set redirect to 'manual' to prevent proxy from swallowing 302 redirects
        const response = await fetch(backendUrl, {
            method: request.method,
            headers: headers,
            body: body,
            cache: 'no-store',
            redirect: 'manual',
        });

        console.log(`[Proxy][${requestId}] Backend Status: ${response.status} ${response.statusText}`);

        // 4. Extract headers from backend response
        const responseHeaders = new Headers();
        const headersToSkip = [
            'content-encoding',
            'transfer-encoding',
            'content-length',
            'connection',
            'keep-alive',
            'proxy-authenticate',
            'proxy-authorization',
            'te',
            'trailer',
            'upgrade'
        ];

        response.headers.forEach((value, key) => {
            // Forward headers that are not in the skip list
            if (!headersToSkip.includes(key.toLowerCase())) {
                responseHeaders.set(key, value);
            }
        });

        // 5. Robust Set-Cookie handling
        const cookiesToSet = (response.headers as any).getSetCookie
            ? (response.headers as any).getSetCookie()
            : response.headers.get('set-cookie')?.split(', ');

        if (cookiesToSet && Array.isArray(cookiesToSet)) {
            console.log(`[Proxy][${requestId}] Forwarding ${cookiesToSet.length} Set-Cookie headers`);
            responseHeaders.delete('set-cookie');
            cookiesToSet.forEach(cookie => {
                responseHeaders.append('set-cookie', cookie);
            });
        }

        // 6. Handle Redirects (301, 302, 307, 308)
        if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
            const location = response.headers.get('location');
            console.log(`[Proxy][${requestId}] Redirect detected to: ${location}`);
            if (location) {
                responseHeaders.set('location', location);
            }
            return new NextResponse(null, {
                status: response.status || 302,
                headers: responseHeaders,
            });
        }

        // 7. Get response body
        const responseText = await response.text();

        // Peek at data to identify if it's HTML or JSON
        const preview = responseText.substring(0, 100).replace(/\n/g, ' ');
        console.log(`[Proxy][${requestId}] Body Preview: ${preview}`);

        // Add debug header
        responseHeaders.set('X-Proxy-Debug-ID', requestId);

        // 8. Return the proxied response
        return new NextResponse(responseText, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        });
    } catch (error: any) {
        console.error(`[Proxy][${requestId}] Fatal Error:`, error.message);
        return NextResponse.json(
            { error: 'Proxy error', message: error.message, requestId },
            { status: 500 }
        );
    }
}
