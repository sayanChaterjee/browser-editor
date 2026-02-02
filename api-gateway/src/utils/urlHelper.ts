/**
 * Utility to ensure a URL starts with https:// if it's a hostname or a URL missing it.
 * This is particularly useful for Render's injected hostnames which might not include
 * the protocol, and we want to enforce HTTPS for external communication or consistency.
 */
export function normalizeServiceUrl(url: string | undefined): string {
    if (!url) return '';

    // If it's just a hostname (no protocol), default to https://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        // If it's an internal hostname like 'auth-service' on port 3001, 
        // it usually doesn't have https internally, but the user requested https prefix.
        return `https://${url}`;
    }

    // If it's http:// and we want to enforce https://
    if (url.startsWith('http://')) {
        return url.replace('http://', 'https://');
    }

    return url;
}
