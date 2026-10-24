#!/usr/bin/env bash
# End-to-end smoke test against the API gateway.
# Usage: scripts/smoke.sh [gateway_url] [origin]
# Signs up a fresh user, then exercises profile -> save -> list -> open.
set -euo pipefail

GATEWAY="${1:-http://localhost:3000}"
ORIGIN="${2:-http://localhost:3005}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

EMAIL="smoke-$(date +%s)-$RANDOM@example.com"
PASSWORD="Smoke-Test-123!"
PROJECT="smoke-project-$RANDOM"

pass() { printf '  \033[32m✔\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✘\033[0m %s\n%s\n' "$1" "$2"; exit 1; }

# request <name> <method> <path> [json-body] -> sets BODY, fails on non-2xx
request() {
  local name="$1" method="$2" path="$3" data="${4:-}"
  local args=(-s -w '\n%{http_code}' -X "$method" -b "$JAR" -c "$JAR" -H "Origin: $ORIGIN")
  [[ -n "$data" ]] && args+=(-H 'Content-Type: application/json' -d "$data")
  local out status
  out="$(curl "${args[@]}" "$GATEWAY$path")"
  status="${out##*$'\n'}"
  BODY="${out%$'\n'*}"
  [[ "$status" =~ ^2 ]] || fail "$name ($method $path -> $status)" "$BODY"
  pass "$name ($status)"
}

echo "Smoke test: $GATEWAY (origin $ORIGIN)"

request "gateway health" GET /health

request "sign up" POST /api/auth/sign-up/email \
  "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"Smoke Test\"}"

request "session" GET /api/auth/get-session
[[ "$(jq -r '.user.email' <<<"$BODY")" == "$EMAIL" ]] || fail "session user matches" "$BODY"

request "profile" GET /api/v1/user/profile

request "save project" POST /api/v1/code/save \
  "{\"name\":\"$PROJECT\",\"html\":\"<h1>smoke</h1>\",\"css\":\"h1{color:red}\",\"js\":\"console.log(1)\"}"
PROJECT_ID="$(jq -r '._id' <<<"$BODY")"
[[ -n "$PROJECT_ID" && "$PROJECT_ID" != "null" ]] || fail "save returned project id" "$BODY"

request "list projects" GET /api/v1/code
jq -e --arg id "$PROJECT_ID" 'map(._id) | index($id) != null' <<<"$BODY" >/dev/null \
  || fail "saved project appears in list" "$BODY"

request "open project" GET "/api/v1/code/$PROJECT_ID"
[[ "$(jq -r '.html' <<<"$BODY")" == "<h1>smoke</h1>" ]] || fail "project content matches" "$BODY"

# Regression: edits saved after the project was cached must be visible immediately,
# before the flusher writes them to MongoDB.
request "save new edit" POST /api/v1/code/save \
  "{\"name\":\"$PROJECT\",\"html\":\"<h1>edited</h1>\",\"css\":\"\",\"js\":\"\"}"
[[ "$(jq -r '._id' <<<"$BODY")" == "$PROJECT_ID" ]] || fail "second save reuses project id" "$BODY"

request "open project after edit" GET "/api/v1/code/$PROJECT_ID"
[[ "$(jq -r '.html' <<<"$BODY")" == "<h1>edited</h1>" ]] || fail "open returns latest edit" "$BODY"

request "list after edit" GET /api/v1/code
jq -e --arg id "$PROJECT_ID" '.[] | select(._id == $id) | .html == "<h1>edited</h1>"' <<<"$BODY" >/dev/null \
  || fail "list returns latest edit" "$BODY"

echo "All smoke checks passed ($EMAIL)"
