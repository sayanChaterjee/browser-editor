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
            console.log('[API Proxy] Forwarding cookies:', cookieHeader.substring(0, 50) + '...');
        } else {
            console.warn('[API Proxy] No cookies found in request');
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
            redirect: 'manual', // Don't follow redirects automatically
        });

        console.log(`[API Proxy] Response status: ${response.status}`);

        // Get response body
        const responseBody = await response.text();

        // Forward response headers, including Set-Cookie for OAuth callbacks
        const responseHeaders = new Headers();
        response.headers.forEach((value, key) => {
            // Special handling for Set-Cookie headers (critical for OAuth)
            if (key.toLowerCase() === 'set-cookie') {
                responseHeaders.append(key, value);
            } else {
                responseHeaders.set(key, value);
            }
        });

        // Handle redirects (important for OAuth flow)
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (location) {
                console.log(`[API Proxy] Redirecting to: ${location}`);
                return NextResponse.redirect(location, {
                    status: response.status,
                    headers: responseHeaders,
                });
            }
        }

        // Return the proxied response
        return new NextResponse(responseBody, {
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
