# 0014: Transactional outbox

**Status:** accepted; supersedes [0003](0003-events-publish-after-commit.md)'s "no outbox"

## Context
Services published events after their database commit, retrying in the background (ADR 0003).
An event still waiting for its retry was lost if the process stopped, and one that used up its
attempts was dropped: a strike or a ban could happen without the other services ever hearing
about it. ADR 0003 named the outbox as the upgrade path.

## Decision
- **Write the event with the change.** A service saves the event to an `outbox` collection in
  the **same MongoDB transaction** as the change it describes: either both are saved or
  neither is.
  - contest-service: strikes (with the attempt's count), submissions (with the participant's
    "submitted" mark).
  - identity-service: ban and unban (with the user's flag). `user.registered.v1` is saved from
    Better Auth's after-create hook: Better Auth inserts the user outside our transaction, so
    that one is durable from the moment it's saved, not atomic with the insert.
- **A relay sends them.** Each publishing service runs `OutboxRelay` (`@ceditor/common`): it
  takes the oldest pending record, sends it to Kafka, marks it published. Failures back off and
  stop the run, so later events don't overtake earlier ones. It runs every second and is woken
  right after each commit. Records are leased while being sent, so several instances can run
  relays; published ones are kept a week (TTL index) for inspection.
- **Consumers are unchanged:** they already skip event ids they've processed, which covers the
  relay sending an event twice (e.g. a crash after the send, before marking it published).
- **MongoDB as a replica set everywhere:** transactions need one. Atlas is one; docker compose
  and CI run a single-node replica set.

## Alternatives
- **Keep publish-after-commit:** simpler, but loses events on a crash or a long Kafka outage.
- **Embed pending events in the changed document** (single-document atomicity, no
  transactions): works on a standalone MongoDB, but the relay has to know every collection
  that carries events, and a submission's event and its "submitted" mark live in different
  documents.
- **Change streams (CDC) instead of a relay:** also needs a replica set, and turns database
  writes into events implicitly rather than recording the events the code means to send.

## Consequences
- No event is lost once its change commits; delivery is at least once (consumers dedupe).
- Events arrive after a short delay (the next relay run, usually immediate after a wake).
- Local development needs the compose MongoDB (a replica set) or another replica set;
  services running outside Docker connect with `directConnection=true`.
