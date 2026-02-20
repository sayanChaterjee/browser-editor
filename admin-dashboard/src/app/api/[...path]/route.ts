import { NextRequest, NextResponse } from 'next/server';

const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const targetPath = path.join('/');
    const url = `${API_GATEWAY_URL}/${targetPath}${request.nextUrl.search}`;

    try {
        const response = await fetch(url, {
            headers: {
                'cookie': request.headers.get('cookie') || '',
                'content-type': 'application/json',
            },
        });

        const data = await response.text();
        return new NextResponse(data, {
            status: response.status,
            headers: {
                'content-type': response.headers.get('content-type') || 'application/json',
                // Forward Set-Cookie headers
                ...(response.headers.get('set-cookie') ? { 'set-cookie': response.headers.get('set-cookie')! } : {}),
            },
        });
    } catch (error) {
        console.error('Proxy error:', error);
        return NextResponse.json({ error: 'Proxy failed' }, { status: 502 });
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const targetPath = path.join('/');
    const url = `${API_GATEWAY_URL}/${targetPath}`;

    try {
        const body = await request.text();
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'cookie': request.headers.get('cookie') || '',
                'content-type': 'application/json',
            },
            body,
        });

        const data = await response.text();
        return new NextResponse(data, {
            status: response.status,
            headers: {
                'content-type': response.headers.get('content-type') || 'application/json',
            },
        });
    } catch (error) {
        console.error('Proxy error:', error);
        return NextResponse.json({ error: 'Proxy failed' }, { status: 502 });
    }
}
