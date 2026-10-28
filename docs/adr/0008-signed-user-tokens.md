# 0008: Signed user tokens from the gateway to the services

**Status:** accepted

## Context
The gateway validates the session and used to tell the services who the user is in plain
headers (`x-user-id`, `x-user-email`), while the services trusted any request carrying the
shared `INTERNAL_GATEWAY_SECRET`. On the free tier every service has a public URL, so that one
secret was all that stood between the internet and acting as any user: anyone holding it could
call a service directly with `x-user-email` set to an admin's address. The secret is the same
in all four services, never expires, and has already been misconfigured in production twice.

## Decision
The gateway signs a short-lived token for every request it forwards: a JWT (EdDSA, Ed25519)
with the user's id, name and email, `iss: api-gateway`, `aud: <the receiving service>` and a
60-second expiry. It goes in `x-user-token`; plain `x-user-*` headers are stripped at the
gateway and ignored by the services.

- **Only the gateway can sign.** The private key (`USER_TOKEN_PRIVATE_KEY`) is set on the
  gateway alone; the services hold the public key (`USER_TOKEN_PUBLIC_KEY`), which isn't
  secret and is committed in `render.yaml`.
- **A token works at one service only** (audience check), and only for a minute, so a token
  leaked from one service's logs can't be replayed elsewhere or later.
- **The verifier is strict:** only `alg: EdDSA` (no `none` or algorithm confusion), issuer,
  audience, expiry and issued-at are checked, with 5 seconds of clock-skew allowance.
- **Misconfiguration fails at startup:** a bad key stops the service, and the gateway refuses
  to start when its private key doesn't match the public key the services use.
- Signing and verifying use Node's built-in `crypto`, so no JWT library is needed.

The internal secret stays as a second check (and still protects routes without a user).

## Alternatives
- **mTLS / a service mesh:** authenticates the calling service, not the user, and needs
  infrastructure Render doesn't offer.
- **HMAC-signed tokens (HS256):** simpler, but every service could then forge tokens; a leak
  from any service would be as bad as before.
- **Services validating the session cookie themselves:** every service would call
  identity-service (or share its database) on each request.
- **Private networking only:** not available on Render's free tier; worth adding on a paid
  plan, alongside this.

## Consequences
- A leaked internal secret no longer lets anyone act as a user; impersonation needs the
  gateway's private key.
- One Ed25519 signature per proxied request on the gateway and one verification per request
  in a service: tens of microseconds each.
- Rotating the key is a deploy: the new public key in `render.yaml` and the new private key on
  the gateway. Tokens live 60 seconds, so in-flight requests are the only casualties.
- Tokens are not revocable in their 60 seconds; revoking a session still takes effect at the
  gateway immediately (ADR 0002), so no new tokens are issued for it.
