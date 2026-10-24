# Load tests

k6 scenarios run in Docker against the local compose stack, with each app container capped at
**0.5 CPU / 512 MB** (`docker-compose.loadtest.yml`) to approximate a small production instance.
Never point these at production: the free tiers (Atlas M0, Upstash, Aiven, Render) have hard caps,
so you'd measure their limits, not this code.

## Scenarios

| Script | Simulates | Default load |
|---|---|---|
| `editor-load.js` | Users opening the editor: active contest → profile → project list → open project | 50 users, 1m ramp, 3m hold |
| `contest-soak.js` | A running contest: every user autosaves every 10s (Redis write-behind path) | 100 users for 5m |

Each scenario signs up its own users in `setup()`. Every simulated user gets a distinct
`X-Forwarded-For` IP so the gateway's per-IP rate limiter treats them as separate clients.

## Running

```bash
# 1. Start the stack with production-like resource limits
docker compose -f docker-compose.yml -f docker-compose.loadtest.yml up -d --build --wait

# 2. Run a scenario: loadtest/run.sh <scenario> <label> [k6 env vars]
loadtest/run.sh editor-load v0 USERS=50 RAMP=1m HOLD=3m
loadtest/run.sh contest-soak v0 USERS=100 DURATION=5m
```

`run.sh` writes to `results/<label>-<scenario>/`:

- `k6.txt`, `k6-summary.json`: latency percentiles per endpoint, throughput, error rate
- `docker-stats.csv`: CPU and memory per app container, sampled every 5s
- `mongo-ops.txt`: MongoDB insert/update/query counters before and after (write-behind effectiveness)

Restart the app containers before a baseline run so every run starts from a fresh process.

Add `--profile observability` when starting the stack to watch a run live in Grafana
(http://localhost:3010, dashboard "CEditor services").
Write up comparisons in `results/<label>.md`.
