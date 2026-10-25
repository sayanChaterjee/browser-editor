# 0006: Editor saves buffered in Redis (write-behind)

**Status:** accepted (original design; read consistency fixed in Session 1, flush race in Session 6)

## Context
The editor autosaves every few seconds. During a contest, every participant saves at once;
writing each save to MongoDB (Atlas free tier) caused multi-second p99 latencies (v0).

## Decision
A save writes the HTML/CSS/JS to a Redis hash (`project:buffer:<id>`) and marks the project
dirty, in one MULTI. Reads overlay the buffer on the MongoDB document, so users always see
their latest edit. A flusher writes dirty projects to MongoDB every minute. It clears the
dirty mark atomically and only if the buffer still holds the version it wrote, so a save
landing mid-flush is written on the next cycle (this race was found and fixed in Session 6).

## Alternatives
- **Write every save to MongoDB:** simple and durable, but what v0 measured as too slow.
- **Debounce in the browser only:** reduces writes but not the contest-wide burst.

## Consequences
- MongoDB writes during the contest soak dropped from 2,916 to 101 operations (v0 → v1).
- While Redis is down, saves write through to MongoDB and reads skip the cache (added in
  Session 6 after the failure test showed a Redis outage hanging code-service). Projects carry
  `contentUpdatedAt`, so when Redis returns its older buffers are never flushed over newer
  content or shown on reads. See `loadtest/results/chaos.md`.
- Up to a minute of edits lives only in Redis; losing Redis's data then loses them. Acceptable
  for an editor with local (IndexedDB) copies; a product with stricter durability needs Redis
  persistence (AOF) or synchronous writes.
