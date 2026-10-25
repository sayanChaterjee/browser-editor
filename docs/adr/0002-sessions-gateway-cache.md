# 0002: Server-side sessions, validated at the gateway through a Redis cache

**Status:** accepted (Session 3)

## Context
Better Auth keeps sessions in MongoDB. The gateway validated every API request by calling
identity-service: in load test v2 that call was 152 ms of the gateway's 224 ms p95, and
identity-service sat at its CPU cap. Bans needed to take effect immediately; Better Auth's
own 5-minute cookie cache would let a banned user keep going.

## Decision
The gateway caches each validated session in Redis (key: hash of the session cookie, never
the token). Entries live 5 minutes, randomised to 80–100% and never past the session's own
expiry. On a miss the gateway asks identity-service with the cookie cache disabled, so the
answer comes from the database. Revocation is explicit, not TTL-based: sign-out, password
change, session revocation and bans delete the user's entries and briefly block re-caching
(closing the race with a check already in flight). If identity-service is unreachable the
gateway returns 503, not 401, so an outage doesn't sign users out.

## Alternatives
- **Stateless JWTs:** no lookup at all, but revocation needs a denylist (state again) or
  short expiry plus refresh tokens; Better Auth's session model was already in place.
- **Validate Better Auth's signed cookie in the gateway:** couples the gateway to Better
  Auth internals and inherits its 5-minute staleness.

## Consequences
- Gateway p95 224 ms → 34 ms; identity-service handles ~15 session checks per 5 minutes of
  load instead of one per request (load test v3).
- A first attempt with a fixed 60 s TTL caused a cache stampede (all entries expiring
  together); fixed by the longer jittered TTL. See `loadtest/results/v3.md`.
- Session changes that bypass the revocation paths are visible within 5 minutes at worst.
- Without Redis, every request is checked at identity-service again, which can't keep up at
  load: the failure test measured 1–10% 503s during a Redis outage
  (`loadtest/results/chaos.md`). A per-instance in-memory cache would soften this, but it can't
  be revoked remotely, so it was not added.
