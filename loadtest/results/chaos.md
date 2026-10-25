# Failure test: dependencies taken down under load

`loadtest/chaos.sh` runs both scenarios at once (50 users opening the editor, 100 users
autosaving every 10 s), with the usual 0.5 CPU / 512 MB caps. It then takes one dependency
down for 45 s at a time, with 45 s of recovery in between. Errors and p95 per phase come from
the k6 output (`loadtest/chaos_report.py`), so they are what users experienced.

## Summary

| Outage | Users saw | Recovery |
|---|---|---|
| **Kafka** | No impact: 0 errors on every endpoint; sign-up works | An event published during the outage was delivered 35 s after Kafka restarted (broker start-up and consumer rejoin); nothing lost |
| **contest-service** | Only the contest endpoint fails, with a fast 503 (circuit breaker); editing and saving unaffected | Errors stop 2 s after restart |
| **identity-service** | Projects, opening and saving keep working (0 errors): the gateway's session cache keeps signed-in users going. Only the profile endpoint (served by identity-service) fails, fast | Errors stop 3 s after restart |
| **Redis** | After the fix: reads and saves keep working from MongoDB; 0.3–10% errors (see below) | No errors after restart |

## Redis: found, fixed, re-measured

The first run showed a Redis outage taking code-service down entirely. Its Redis client used the
library defaults: each command waited through ~20 reconnect attempts. Requests hung for 10–40 s,
tied up every user's slot and slowed even unrelated endpoints.

Fixes (Session 6):

1. **Fail fast:** code-service's client no longer queues commands while disconnected (the
   gateway's already didn't).
2. **Reads fall back to MongoDB:** the project list and project reads skip the cache.
3. **Saves write through to MongoDB:** `/save` and `/sync` write directly while Redis is down.
   Projects carry `contentUpdatedAt`, so when Redis returns, its older buffers are never flushed
   over newer content or shown on reads. Stale copies of written-through projects are dropped on
   reconnect. Covered by tests in `code-service/src/routes/writeBehind.test.ts`.

| Endpoint during a 45 s Redis outage | Before: failed / p95 | After: failed / p95 |
|---|---|---|
| save | 100% / 41.8 s | **9.9% / 3.0 s** |
| projects (list) | 98% / 10.8 s | **0.8% / 0.7 s** |
| project (open) | 98% / 33.1 s | **0.3% / 0.7 s** |
| profile | 0% / 2.4 s | 1.0% / 3.7 s |
| Requests served per endpoint | ~51 | **~400** (baseline ~640) |

**What's left:** the remaining errors are 503s from the gateway, not code-service. Without
Redis the gateway also loses its session cache, so every request goes back to identity-service
for a session check, as before Session 3. At its 0.5 CPU cap identity-service can't keep up, so
some checks exceed the gateway's 3 s timeout. A per-instance in-memory session cache would soften
this. It wasn't added, because an in-memory cache can't be revoked remotely: during a Redis
outage a ban would then take effect only when that cache expired.

## Full results (after the fix)

| Phase | Endpoint | Requests | Failed | p95 | Statuses |
|---|---|---|---|---|---|
| Baseline (45s) | contest_active | 639 | 0 (0.0%) | 56 ms | 404×639 |
| Baseline (45s) | profile | 639 | 0 (0.0%) | 70 ms | 200×639 |
| Baseline (45s) | projects | 639 | 0 (0.0%) | 55 ms | 200×639 |
| Baseline (45s) | project | 639 | 0 (0.0%) | 60 ms | 200×639 |
| Baseline (45s) | save | 497 | 0 (0.0%) | 165 ms | 200×497 |
| Kafka down (46s) | contest_active | 646 | 0 (0.0%) | 51 ms | 404×646 |
| Kafka down (46s) | profile | 646 | 0 (0.0%) | 32 ms | 200×646 |
| Kafka down (46s) | projects | 645 | 0 (0.0%) | 38 ms | 200×645 |
| Kafka down (46s) | project | 645 | 0 (0.0%) | 28 ms | 200×645 |
| Kafka down (46s) | save | 428 | 0 (0.0%) | 79 ms | 200×428 |
| Kafka recovered (45s) | contest_active | 622 | 0 (0.0%) | 113 ms | 404×622 |
| Kafka recovered (45s) | profile | 622 | 0 (0.0%) | 92 ms | 200×622 |
| Kafka recovered (45s) | projects | 623 | 0 (0.0%) | 89 ms | 200×623 |
| Kafka recovered (45s) | project | 623 | 0 (0.0%) | 87 ms | 200×623 |
| Kafka recovered (45s) | save | 472 | 0 (0.0%) | 198 ms | 200×472 |
| Redis down (45s) | contest_active | 400 | 7 (1.8%) | 2257 ms | 404×393, 503×7 |
| Redis down (45s) | profile | 399 | 4 (1.0%) | 3729 ms | 200×395, 503×4 |
| Redis down (45s) | projects | 398 | 3 (0.8%) | 711 ms | 200×395, 503×3 |
| Redis down (45s) | project | 396 | 1 (0.3%) | 716 ms | 200×395, 503×1 |
| Redis down (45s) | save | 403 | 40 (9.9%) | 3006 ms | 200×363, 503×40 |
| Redis recovered (51s) | contest_active | 719 | 0 (0.0%) | 55 ms | 404×719 |
| Redis recovered (51s) | profile | 720 | 0 (0.0%) | 58 ms | 200×720 |
| Redis recovered (51s) | projects | 721 | 0 (0.0%) | 57 ms | 200×721 |
| Redis recovered (51s) | project | 723 | 0 (0.0%) | 51 ms | 200×723 |
| Redis recovered (51s) | save | 505 | 0 (0.0%) | 80 ms | 200×505 |
| contest-service down (48s) | contest_active | 658 | 656 (99.7%) | 249 ms | 404×2, 503×656 |
| contest-service down (48s) | profile | 658 | 0 (0.0%) | 130 ms | 200×658 |
| contest-service down (48s) | projects | 658 | 0 (0.0%) | 95 ms | 200×658 |
| contest-service down (48s) | project | 658 | 0 (0.0%) | 102 ms | 200×658 |
| contest-service down (48s) | save | 492 | 0 (0.0%) | 504 ms | 200×492 |
| contest-service recovered (51s) | contest_active | 703 | 25 (3.6%) | 50 ms | 404×678, 503×25 |
| contest-service recovered (51s) | profile | 701 | 0 (0.0%) | 41 ms | 200×701 |
| contest-service recovered (51s) | projects | 701 | 0 (0.0%) | 42 ms | 200×701 |
| contest-service recovered (51s) | project | 701 | 0 (0.0%) | 32 ms | 200×701 |
| contest-service recovered (51s) | save | 500 | 0 (0.0%) | 194 ms | 200×500 |
| identity-service down (45s) | contest_active | 634 | 0 (0.0%) | 37 ms | 404×634 |
| identity-service down (45s) | profile | 636 | 633 (99.5%) | 55 ms | 200×3, 503×633 |
| identity-service down (45s) | projects | 635 | 0 (0.0%) | 30 ms | 200×635 |
| identity-service down (45s) | project | 634 | 0 (0.0%) | 30 ms | 200×634 |
| identity-service down (45s) | save | 442 | 0 (0.0%) | 74 ms | 200×442 |
| identity-service recovered (51s) | contest_active | 719 | 0 (0.0%) | 33 ms | 404×719 |
| identity-service recovered (51s) | profile | 719 | 55 (7.6%) | 39 ms | 200×664, 503×55 |
| identity-service recovered (51s) | projects | 720 | 0 (0.0%) | 38 ms | 200×720 |
| identity-service recovered (51s) | project | 721 | 0 (0.0%) | 28 ms | 200×721 |
| identity-service recovered (51s) | save | 520 | 0 (0.0%) | 75 ms | 200×520 |

The few contest/profile errors in the "recovered" rows fall in the first 2–3 s after the
restart, while the service was still starting.

Re-run: `docker compose -f docker-compose.yml -f docker-compose.loadtest.yml --profile observability up -d --build --wait`, then `loadtest/chaos.sh` (~12 min).
