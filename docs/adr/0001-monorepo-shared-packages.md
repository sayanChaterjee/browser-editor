# 0001: Monorepo with shared packages

**Status:** accepted (Session 2)

## Context
Each service had its own lockfile and copy-pasted infrastructure code (logger, config,
Redis and Kafka clients, health checks). Copies had drifted: one service's logger leaked
memory, another's Kafka consumer crashed the process on start-up.

## Decision
One npm-workspaces repository: one lockfile, `packages/common` for infrastructure
(config validation, logging, correlation IDs, Redis/Kafka clients with background retry,
health, metrics, graceful shutdown, session cache, event publishing/consuming) and
`packages/contracts` for event schemas. Services stay independently built and deployed:
each Dockerfile installs only its own workspace plus the shared packages, and Render
redeploys a service only when its folder or `packages/` change.

## Alternatives
- **Repo per service:** true independence, but shared code then needs a private registry
  and version bumps across repos; too much overhead for one developer.
- **Copy-paste per service:** what existed; it drifted.

## Consequences
- A change to `common` redeploys every service; acceptable at this size, and CI tests the
  shared packages directly.
- Services can't pin different versions of `common`. If they ever must, publish it.
