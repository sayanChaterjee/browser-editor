#!/usr/bin/env bash
# Failure test: runs both load scenarios (reads and saves) while taking dependencies down
# one at a time, then reports errors and latency per phase from the k6 output.
# Usage: loadtest/chaos.sh   (stack up with docker-compose.loadtest.yml)
# Output: loadtest/results/chaos/{phases.csv,report.md} plus the two k6 result folders
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/results/chaos"
PHASES="$OUT/phases.csv"
GATEWAY=http://localhost:3000
ORIGIN=http://localhost:3005
OUTAGE=${OUTAGE:-45}     # seconds each dependency stays down
RECOVERY=${RECOVERY:-45} # seconds between outages
mkdir -p "$OUT"
echo "phase,epoch" > "$PHASES"

phase() { echo "$1,$(date +%s.%N)" >> "$PHASES"; echo "[$(date +%T)] $1"; }
healthy() { [[ "$(docker inspect -f '{{.State.Health.Status}}' "$1" 2>/dev/null)" == healthy ]]; }
wait_healthy() { for _ in $(seq 1 90); do healthy "$1" && return 0; sleep 1; done; echo "  $1 not healthy after 90s"; }

# Both scenarios in the background, recording every request (k6 JSON output)
"$ROOT/run.sh" editor-load chaos USERS=50 RAMP=30s HOLD=8m \
  K6_OUT="json=/scripts/results/chaos-editor-load/k6.json" > "$OUT/editor-load.log" 2>&1 &
EDITOR_PID=$!
"$ROOT/run.sh" contest-soak chaos USERS=100 DURATION=9m \
  K6_OUT="json=/scripts/results/chaos-contest-soak/k6.json" > "$OUT/contest-soak.log" 2>&1 &
SOAK_PID=$!

echo "Waiting for both scenarios to finish signing up users..."
active() { grep -qE 'running \([^)]*\), 0*[1-9][0-9]*/[0-9]+ VUs' "$1" 2>/dev/null; }
until active "$OUT/editor-load.log" && active "$OUT/contest-soak.log"; do sleep 2; done
sleep 30 # let both reach steady load

phase baseline
sleep "$RECOVERY"

# Kafka: sign up while it's down; the starter project must appear once it's back
phase kafka-down
docker stop kafka > /dev/null
JAR="$(mktemp)"
curl -s -o /dev/null -c "$JAR" -H "Origin: $ORIGIN" -H 'Content-Type: application/json' -H 'X-Forwarded-For: 10.250.0.1' \
  -d "{\"email\":\"chaos-$(date +%s)@loadtest.local\",\"password\":\"Load-Test-123!\",\"name\":\"Chaos\"}" \
  -w "  sign-up with Kafka down: %{http_code}\n" "$GATEWAY/api/auth/sign-up/email"
sleep "$OUTAGE"
phase kafka-up
docker start kafka > /dev/null
KAFKA_UP=$(date +%s)
( for _ in $(seq 1 120); do
    if curl -s -b "$JAR" -H "Origin: $ORIGIN" -H 'X-Forwarded-For: 10.250.0.1' "$GATEWAY/api/v1/code" | grep -q '"Welcome"'; then
      echo "starter project delivered $(( $(date +%s) - KAFKA_UP ))s after Kafka restarted" > "$OUT/kafka-event.txt"; exit 0
    fi
    sleep 1
  done; echo "starter project NOT delivered within 120s" > "$OUT/kafka-event.txt" ) &
sleep "$RECOVERY"

phase redis-down
docker stop redis > /dev/null
sleep "$OUTAGE"
phase redis-up
docker start redis > /dev/null
wait_healthy redis
sleep "$RECOVERY"

phase contest-down
docker stop contest-service > /dev/null
sleep "$OUTAGE"
phase contest-up
docker start contest-service > /dev/null
wait_healthy contest-service
sleep "$RECOVERY"

phase identity-down
docker stop identity-service > /dev/null
sleep "$OUTAGE"
phase identity-up
docker start identity-service > /dev/null
wait_healthy identity-service
sleep "$RECOVERY"
phase end

echo "Waiting for the load scenarios to finish..."
wait "$EDITOR_PID" "$SOAK_PID" || true
wait
rm -f "$JAR"

python3 -I "$ROOT/chaos_report.py" "$PHASES" "$ROOT/results/chaos-editor-load/k6.json" "$ROOT/results/chaos-contest-soak/k6.json" \
  | tee "$OUT/report.md"
cat "$OUT/kafka-event.txt"
