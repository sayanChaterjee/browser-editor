/**
 * Utility to ensure a URL has a protocol.
 * For Render's web services, we use http:// for internal service-to-service communication
 * even though they're publicly accessible via HTTPS.
 */
export function normalizeServiceUrl(url: string | undefined): string {
    if (!url) return '';

    // If it's just a hostname (no protocol), use http:// for internal service calls
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return `http://${url}`;
    }

    // Preserve the protocol if it's already there
    return url;
}
