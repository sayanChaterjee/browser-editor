# 0003: Events published after commit, no outbox

**Status:** accepted (Session 4)

## Context
Services need to react to each other's changes (a new user gets a starter project, a ban
disqualifies submissions) without calling each other synchronously. A service writes to
MongoDB and publishes to Kafka: two systems, no shared transaction (the dual-write problem).

## Decision
- Publish **after** the database commit, with bounded background retries (~2 minutes), so
  the request never waits on Kafka and an event never announces something that didn't happen.
- Every event has an envelope (`eventId`, versioned `type`, `occurredAt`, `source`,
  `correlationId`, `data`) validated by zod schemas in `@ceditor/contracts`.
- Consumers are idempotent: they record handled `eventId`s (7-day TTL) and skip repeats,
  and handlers are safe to run twice anyway.
- Malformed messages, and messages still failing after retries, go to a dead-letter topic
  with their origin and error, so one bad message can't block the rest.

## Alternatives
- **Transactional outbox:** write the event in the same transaction as the change, relay it
  to Kafka. Guarantees delivery; needs replica-set transactions and a relay process.
- **Synchronous HTTP calls between services:** simpler, but couples availability (sign-up
  fails if code-service is down) and timing.

## Consequences
- If the process dies between the commit and the publish, or Kafka is unreachable for longer
  than the retries, the event is lost. This is logged and counted
  (`events_published_total{result="failed"}`). None of today's events is safety-critical:
  bans are enforced synchronously by identity-service; events only drive side effects.
- Upgrade path: add an outbox for an event that must not be lost; consumers don't change.
