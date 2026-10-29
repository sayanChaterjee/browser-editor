import { NextRequest, NextResponse } from 'next/server';

// Browsers POST Content-Security-Policy violations here (report-uri in lib/csp.ts). They go to
// the server log (Vercel's function logs). Anyone can post, so reports are size-capped and
// logged as one short line.
const MAX_BODY = 8 * 1024;

export async function POST(request: NextRequest) {
    const body = (await request.text()).slice(0, MAX_BODY);
    let report: Record<string, unknown> = {};
    try {
        report = JSON.parse(body)['csp-report'] ?? {};
    } catch {
        // not JSON: ignored
    }
    const field = (name: string) => String(report[name] ?? '').slice(0, 200);
    console.warn(
        `[CSP] ${field('effective-directive') || field('violated-directive')} blocked ${field('blocked-uri')} on ${field('document-uri')}`,
    );
    return new NextResponse(null, { status: 204 });
}
