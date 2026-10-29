# 0009: Rate limits and sign-in lockout keep working without Redis

**Status:** accepted

## Context
The gateway's rate limits (per IP, per user, and a strict per-IP limit on sign-in and
sign-up) kept their counts in Redis and were set to let every request through when Redis
failed, so an outage stayed invisible to users. It also switched the limits off: during an
outage, or one an attacker caused, nothing slowed down password guessing or request floods.
Separately, the per-IP limits can't stop guessing one account's password from many IPs.

## Decision
- **Fallback store.** Each gateway limiter counts in Redis while it is up, and in the gateway's
  own memory while it is down or a call fails. Limits are then per instance instead of shared,
  which on a single Render instance is the same thing; letting everything through remains only
  a last resort if the store itself throws.
- **Per-email lockout** in identity-service, through Better Auth's `before`/`after` hooks on
  `/sign-in/email`: 10 failed sign-ins (401) for an address within 15 minutes lock it until the
  window ends (429 with `Retry-After`); the password isn't checked while locked. A successful
  sign-in clears the count. Counts are in Redis under a SHA-256 of the address, with the same
  in-memory fallback.
- **Visible degradation.** `rate_limit_store_fallbacks_total` and
  `login_lockout_events_total{event="fallback"}` count fallbacks; Prometheus alert rules fire on
  any fallback and on a spike in failed sign-ins.

## Alternatives
- **Fail closed (reject when Redis is down):** safe against abuse, but a Redis outage would
  take down sign-in for everyone.
- **Edge rate limiting (Cloudflare, a WAF):** the right outer layer in production; not
  configurable on Render's free tier. The in-app limits stay as the inner layer either way.
- **CAPTCHA after failures:** better for users than a hard lock; needs a CAPTCHA provider
  (planned with email verification).
- **Lockout per (email, IP):** can't be used to lock someone else out, but doesn't stop the
  many-IP attack it is meant for.

## Consequences
- Anyone can lock an address for 15 minutes by failing to sign in to it 10 times. The lock is
  short, needs no account, and Google sign-in is unaffected; a CAPTCHA would soften it.
- Counts restart when Redis comes back (the memory and Redis counts aren't merged), so an
  attacker gains at most one extra window's worth of attempts per outage.
- With several gateway instances and Redis down, each instance has its own count.
