/**
 * Content-Security-Policy for the app's pages, with a fresh nonce per request.
 *
 * Scripts run only if they carry the nonce (Next.js adds it to its own) or were loaded by a
 * script that did ('strict-dynamic', which covers Monaco's loader from the CDN). No
 * 'unsafe-inline' or 'unsafe-eval' for scripts: injected markup can't run code. Styles still
 * allow inline, which Next.js, Monaco and xterm all inject; that's far less dangerous.
 *
 * Previews don't need anything here: they run in /preview-frame.html, which has its own
 * policy (next.config.ts).
 */

const MONACO_CDN = "https://cdn.jsdelivr.net";

export const CSP_REPORT_PATH = "/api/csp-report";

export function createNonce(): string {
  return btoa(crypto.randomUUID());
}

export function contentSecurityPolicy(nonce: string, { dev = false } = {}): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // https: is ignored by browsers that support 'strict-dynamic'; it's the fallback for old ones.
    // Development only: React uses eval for debugging stack traces.
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "https:", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'", MONACO_CDN],
    // Admin-entered question images and Google profile pictures come from anywhere over https
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:", MONACO_CDN],
    "connect-src": ["'self'", MONACO_CDN],
    // Monaco's language workers start from blob: URLs
    "worker-src": ["'self'", "blob:"],
    "frame-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "report-uri": [CSP_REPORT_PATH],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}
