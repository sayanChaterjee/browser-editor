# 0010: Nonce-based CSP, with previews in a frame page of their own

**Status:** accepted

## Context
The frontend sent no Content-Security-Policy, and the gateway's allowed `'unsafe-inline'` and
`'unsafe-eval'`. Without a strict policy, one HTML-injection bug anywhere in the app runs the
attacker's script as the signed-in user.

A strict policy couldn't simply be added: previews were `srcdoc` iframes, and a `srcdoc`
document inherits the CSP of the page that embeds it. The editor's policy would then have
blocked the user's own inline `<script>` tags and `onclick` handlers.

## Decision
- **Pages:** the Next.js middleware gives every page a policy with a fresh nonce per request:
  `script-src 'self' 'nonce-…' 'strict-dynamic'`, with no `'unsafe-inline'` or
  `'unsafe-eval'` (eval only in development, for React's tooling). Next.js adds the nonce to its
  own scripts; `'strict-dynamic'` lets those load further scripts (chunks, Monaco from the CDN).
  Also `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.
  Pages render per request, since a page prerendered at build time can't carry a request's nonce.
- **Previews** load `/preview-frame.html` in the same sandbox as before (`allow-scripts`, no
  `allow-same-origin`). The frame asks for its document (`PREVIEW_READY`), the app sends it
  (`PREVIEW_RENDER`), and the frame writes it in. A navigated frame has its own policy instead of
  inheriting the app's: `frame-ancestors 'self'` only, so user code runs as it did before.
- **Gateway:** it serves only JSON and redirects, so `default-src 'none'`.
- **Reporting:** violations go to `/api/csp-report` and show in the server log.
  `CSP_REPORT_ONLY=true` switches to report-only, a quick way back if something breaks.

## Alternatives
- **A looser policy on the editor and admin pages only:** keeps `srcdoc`, but leaves the pages
  that show other people's content without script protection.
- **Hash-based policy:** works for static pages, but every page here renders per request anyway.
- **The preview on a separate origin:** the stronger follow-up. The frame page makes it a
  configuration change (`PREVIEW_FRAME_URL`).

## Consequences
- An injected `<script>` or event handler on an app page is blocked and reported (checked in a
  real browser against the production build).
- Every page renders on the server per request, a small cost on Vercel.
- Styles still allow `'unsafe-inline'`, which Next.js, Monaco and xterm inject. CSS injection is
  a far weaker attack than script injection.
- The preview frame is on the app's origin, so the sandbox is still what isolates user code.
