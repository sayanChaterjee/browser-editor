# Architecture decision records

Short records of the decisions that shaped the system: the context, the choice, the
alternatives and what it costs. Each is the state of thinking when it was made.

| # | Decision |
|---|---|
| [0001](0001-monorepo-shared-packages.md) | npm-workspaces monorepo with shared `common` and `contracts` packages |
| [0002](0002-sessions-gateway-cache.md) | Server-side sessions, validated at the gateway through a Redis cache with explicit revocation |
| [0003](0003-events-publish-after-commit.md) | Events published after commit with retries, no outbox; idempotent consumers and a dead-letter topic |
| [0004](0004-topic-per-service.md) | One Kafka topic per publishing service plus one shared dead-letter topic |
| [0005](0005-contest-service-split.md) | Contests in their own service; strikes owned there; gateway aliases for old paths |
| [0006](0006-write-behind-saves.md) | Editor saves buffered in Redis and flushed to MongoDB (write-behind) |
| [0007](0007-database-per-service.md) | A database per service, on one shared cluster |
| [0008](0008-signed-user-tokens.md) | User identity passed to services as gateway-signed, per-service, 60-second Ed25519 tokens |
| [0009](0009-limits-without-redis.md) | Rate limits fall back to memory without Redis; per-email sign-in lockout |
