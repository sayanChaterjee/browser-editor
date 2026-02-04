/**
 * Utility to ensure a URL has a protocol.
 * For Render's internal services, we preserve http:// if provided.
 * If no protocol is provided, we default to https:// for external consistency.
 */
export function normalizeServiceUrl(url: string | undefined): string {
    if (!url) return '';

    // If it's just a hostname (no protocol), default to https://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return `https://${url}`;
    }

    // Preserve the protocol if it's already there (don't force upgrade http -> https)
    return url;
}
