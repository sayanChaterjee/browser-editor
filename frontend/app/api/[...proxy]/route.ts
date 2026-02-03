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
    try {
        // Reconstruct the full path
        const path = pathSegments.join('/');
        const searchParams = request.nextUrl.searchParams.toString();
        const backendUrl = `${BACKEND_URL}/api/${path}${searchParams ? `?${searchParams}` : ''}`;

        console.log(`[API Proxy] ${request.method} ${backendUrl}`);

        // Get cookies from the request
        const cookieHeader = request.headers.get('cookie');

        // Build headers to forward to backend
        const headers = new Headers();

        // Forward important headers
        request.headers.forEach((value, key) => {
            // Skip host and connection headers
            if (!['host', 'connection'].includes(key.toLowerCase())) {
                headers.set(key, value);
            }
        });

        // Explicitly set cookie header
        if (cookieHeader) {
            headers.set('cookie', cookieHeader);
            console.log('[API Proxy] Forwarding cookies:');
            console.log('[API Proxy] Full cookie header:', cookieHeader);
            // Parse and log individual cookies
            const cookies = cookieHeader.split(';').map(c => c.trim());
            cookies.forEach(cookie => {
                const [name] = cookie.split('=');
                console.log(`[API Proxy]   - ${name}`);
            });
        } else {
            console.warn('[API Proxy] ⚠️ No cookies found in request');
        }

        // Get request body for non-GET requests
        let body: string | undefined;
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            body = await request.text();
        }

        // Make the proxied request
        const response = await fetch(backendUrl, {
            method: request.method,
            headers: headers,
            body: body,
        });

        console.log(`[API Proxy] Response status: ${response.status}`);

        // Use arrayBuffer to avoid mangling any binary or encoded data
        const responseData = await response.arrayBuffer();

        // Forward response headers, but EXCLUDE those that refer to the body encoding
        // as fetch already handled decompression
        const responseHeaders = new Headers();
        const hopByHopHeaders = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade'];
        const contentHeaders = ['content-encoding', 'content-length'];

        response.headers.forEach((value, key) => {
            const lowerKey = key.toLowerCase();
            if (!hopByHopHeaders.includes(lowerKey) && !contentHeaders.includes(lowerKey)) {
                responseHeaders.append(key, value);
                if (lowerKey === 'set-cookie') {
                    console.log(`[API Proxy] Passing Set-Cookie: ${value.substring(0, 50)}...`);
                }
            }
        });

        // Set content-type explicitly if it exists
        const contentType = response.headers.get('content-type');
        if (contentType && !responseHeaders.has('content-type')) {
            responseHeaders.set('content-type', contentType);
        }

        // Return the proxied response
        return new NextResponse(responseData, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        });
    } catch (error: any) {
        console.error('[API Proxy] Error:', error.message);
        return NextResponse.json(
            { error: 'Proxy error', message: error.message },
            { status: 500 }
        );
    }
}
