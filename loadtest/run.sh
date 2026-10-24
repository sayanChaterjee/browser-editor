#!/usr/bin/env bash
# Runs one k6 scenario (in Docker) and captures server-side numbers alongside it.
# Usage: loadtest/run.sh <scenario> <label> [K6_ENV=value ...]
#   e.g. loadtest/run.sh contest-soak v0 USERS=100 DURATION=5m
# Output: loadtest/results/<label>-<scenario>/{k6-summary.json,k6.txt,docker-stats.csv,mongo-ops.txt}
set -euo pipefail

SCENARIO="$1"; LABEL="$2"; shift 2
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/results/$LABEL-$SCENARIO"
mkdir -p "$OUT"

APPS=(api-gateway identity-service code-service)
ENV_ARGS=()
for kv in "$@"; do ENV_ARGS+=(-e "$kv"); done

mongo_ops() {
  docker exec mongo mongosh --quiet --eval \
    'const o=db.serverStatus().opcounters; print(JSON.stringify({insert:o.insert,update:o.update,delete:o.delete,query:o.query}))'
}

echo "scenario=$SCENARIO label=$LABEL env=$*" | tee "$OUT/run-info.txt"
echo "before: $(mongo_ops)" > "$OUT/mongo-ops.txt"

# Sample container CPU/memory every 5s while k6 runs.
echo "time,container,cpu,mem" > "$OUT/docker-stats.csv"
(
  while true; do
    docker stats --no-stream --format "{{.Name}},{{.CPUPerc}},{{.MemUsage}}" "${APPS[@]}" \
      | sed "s/^/$(date +%T),/" >> "$OUT/docker-stats.csv"
    sleep 5
  done
) &
STATS_PID=$!
trap 'kill $STATS_PID 2>/dev/null || true' EXIT

docker run --rm --network host \
  --user "$(id -u):$(id -g)" \
  -v "$ROOT:/scripts" \
  "${ENV_ARGS[@]}" \
  grafana/k6:0.54.0 run \
  --summary-export "/scripts/results/$LABEL-$SCENARIO/k6-summary.json" \
  "/scripts/$SCENARIO.js" 2>&1 | tee "$OUT/k6.txt" || true

echo "after:  $(mongo_ops)" >> "$OUT/mongo-ops.txt"
cat "$OUT/mongo-ops.txt"
echo "Results in $OUT"
