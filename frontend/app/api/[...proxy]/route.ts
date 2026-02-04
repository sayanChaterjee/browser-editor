import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'https://api-gateway-rq2x.onrender.com';

/**
 * API Route Proxy - Catch-all handler for /api/*
 * 
 * This manually proxies all API requests to the Render backend while
 * explicitly forwarding cookies. This is necessary because Next.js
 * middleware rewrites cannot modify headers for external URLs.
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
        // Reconstruct the full path
        const path = pathSegments.join('/');
        const searchParams = request.nextUrl.searchParams.toString();
        const backendUrl = `${BACKEND_URL}/api/${path}${searchParams ? `?${searchParams}` : ''}`;

        console.log(`[Proxy][${requestId}] Request: ${request.method} ${backendUrl}`);

        // 1. Build headers to forward to backend
        const headers = new Headers();
        request.headers.forEach((value, key) => {
            // Forward everything except host and connection
            if (!['host', 'connection'].includes(key.toLowerCase())) {
                headers.set(key, value);
            }
        });

        // Log cookies we are sending
        const outgoingCookie = headers.get('cookie');
        if (outgoingCookie) {
            console.log(`[Proxy][${requestId}] Outgoing Cookies:`, outgoingCookie.substring(0, 50) + '...');
        }

        // 2. Get request body for non-GET requests
        let body: string | undefined;
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            body = await request.text();
        }

        // 3. Make the proxied request
        const response = await fetch(backendUrl, {
            method: request.method,
            headers: headers,
            body: body,
            cache: 'no-store',
        });

        console.log(`[Proxy][${requestId}] Backend Status: ${response.status} ${response.statusText}`);

        // 4. Extract headers from backend response
        const responseHeaders = new Headers();

        // Log all backend response headers for debugging
        const backendHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
            backendHeaders[key] = value;
            // Forward all headers except content-length (let Next.js recalculate)
            if (key.toLowerCase() !== 'content-length') {
                responseHeaders.set(key, value);
            }
        });
        console.log(`[Proxy][${requestId}] Backend Headers:`, JSON.stringify(backendHeaders));

        // 5. Robust Set-Cookie handling
        // Standard .get('set-cookie') only returns the FIRST one in some environments
        // getSetCookie() is the spec-compliant way to get ALL of them
        const cookiesToSet = (response.headers as any).getSetCookie
            ? (response.headers as any).getSetCookie()
            : response.headers.get('set-cookie')?.split(', ');

        if (cookiesToSet && Array.isArray(cookiesToSet)) {
            console.log(`[Proxy][${requestId}] Forwarding ${cookiesToSet.length} Set-Cookie headers`);
            responseHeaders.delete('set-cookie'); // Clear any single joined header
            cookiesToSet.forEach(cookie => {
                responseHeaders.append('set-cookie', cookie);
            });
        }

        // 6. Get response body
        const responseText = await response.text();

        // Peek at data to identify if it's HTML or JSON
        const preview = responseText.substring(0, 100).replace(/\n/g, ' ');
        console.log(`[Proxy][${requestId}] Body Preview: ${preview}`);

        // Add debug header
        responseHeaders.set('X-Proxy-Debug-ID', requestId);

        // 7. Return the proxied response
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
