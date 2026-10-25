# 0004: One topic per publishing service, one shared dead-letter topic

**Status:** accepted (Session 4)

## Context
Production Kafka (Aiven free tier) allows five topics. A topic per event type plus a
dead-letter topic per consumer would exceed that quickly.

## Decision
- One topic per publishing service: `identity.user-events`, `contest.events`. The event
  `type` in the envelope tells consumers what each message is.
- Messages are keyed by `userId`, so all of a user's events land in one partition, in order
  (a ban and a later unban can't be applied in the wrong order).
- One shared `dead-letter` topic; headers record the source topic, partition, offset,
  consumer group and error.

## Alternatives
- **Topic per event type:** finer-grained subscriptions, but loses cross-type ordering per
  user and multiplies topics.

## Consequences
- Consumers receive event types they don't use and skip them (cheap at this volume).
- Three topics in use, two spare.
