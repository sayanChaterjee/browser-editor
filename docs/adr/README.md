# Architecture decision records

Short records of the decisions that shaped the system: the context, the choice, the
alternatives and what it costs. Each is the state of thinking when it was made.

| # | Decision |
|---|---|
| [0001](0001-monorepo-shared-packages.md) | npm-workspaces monorepo with shared `common` and `contracts` packages |
| [0002](0002-sessions-gateway-cache.md) | Server-side sessions, validated at the gateway through a Redis cache with explicit revocation |
| [0003](0003-events-publish-after-commit.md) | Events published after commit with retries; idempotent consumers and a dead-letter topic (outbox part superseded by 0014) |
| [0004](0004-topic-per-service.md) | One Kafka topic per publishing service plus one shared dead-letter topic |
| [0005](0005-contest-service-split.md) | Contests in their own service; strikes owned there; gateway aliases for old paths |
| [0006](0006-write-behind-saves.md) | Editor saves buffered in Redis and flushed to MongoDB (write-behind) |
| [0007](0007-database-per-service.md) | A database per service, on one shared cluster |
| [0008](0008-signed-user-tokens.md) | User identity passed to services as gateway-signed, per-service, 60-second Ed25519 tokens |
| [0009](0009-limits-without-redis.md) | Rate limits fall back to memory without Redis; per-email sign-in lockout |
| [0010](0010-strict-csp-preview-frame.md) | Nonce-based CSP on every page; previews in their own sandboxed frame page |
| [0011](0011-contest-signals.md) | Contest heartbeats, typed vs pasted counts and code similarity, flagged for admin review |
| [0012](0012-scheduled-contests-and-rooms.md) | Contests run on their schedule; rooms to join; the question held back until the start |
| [0013](0013-roles-in-the-user-token.md) | Roles stored by identity-service and carried as a claim in the gateway-signed user token |
| [0014](0014-transactional-outbox.md) | Events saved in the same transaction as their change, sent by a relay |
| [0015](0015-contest-replay.md) | Heartbeats carry code size and minute snapshots; admins replay how a submission came about |
