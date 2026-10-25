#!/usr/bin/env bash
# End-to-end smoke test against the API gateway.
# Usage: scripts/smoke.sh [gateway_url] [origin]
# Signs up a fresh user, then exercises the starter project (user.registered.v1 event),
# profile -> save -> list -> open, sign-out and, when SMOKE_ADMIN_EMAIL is in the stack's
# ADMIN_EMAILS, a contest (strike -> submit, through the paths the frontend calls) and
# ban -> unban (including the submission disqualification events).
set -euo pipefail

GATEWAY="${1:-http://localhost:3000}"
ORIGIN="${2:-http://localhost:3005}"
ADMIN_EMAIL="${SMOKE_ADMIN_EMAIL:-you@example.com}"
JAR="$(mktemp)"
OLD_JAR="$(mktemp)"
ADMIN_JAR="$(mktemp)"
trap 'rm -f "$JAR" "$OLD_JAR" "$ADMIN_JAR"' EXIT

EMAIL="smoke-$(date +%s)-$RANDOM@example.com"
PASSWORD="Smoke-Test-123!"
PROJECT="smoke-project-$RANDOM"

pass() { printf '  \033[32m✔\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✘\033[0m %s\n%s\n' "$1" "$2"; exit 1; }

# call <jar> <method> <path> [json-body] -> sets STATUS and BODY
call() {
  local jar="$1" method="$2" path="$3" data="${4:-}"
  local args=(-s -w '\n%{http_code}' -X "$method" -b "$jar" -c "$jar" -H "Origin: $ORIGIN")
  [[ -n "$data" ]] && args+=(-H 'Content-Type: application/json' -d "$data")
  local out
  out="$(curl "${args[@]}" "$GATEWAY$path")"
  STATUS="${out##*$'\n'}"
  BODY="${out%$'\n'*}"
}

# request <name> <method> <path> [json-body] -> as the test user, fails on non-2xx
request() {
  call "$JAR" "$2" "$3" "${4:-}"
  [[ "$STATUS" =~ ^2 ]] || fail "$1 ($2 $3 -> $STATUS)" "$BODY"
  pass "$1 ($STATUS)"
}

# expect_status <name> <status> <jar> <method> <path> [json-body]
expect_status() {
  call "$3" "$4" "$5" "${6:-}"
  [[ "$STATUS" == "$2" ]] || fail "$1 ($4 $5 -> $STATUS, expected $2)" "$BODY"
  pass "$1 ($STATUS)"
}

# eventually <name> <jar> <path> <jq-condition>: polls a GET until the condition holds (events are async)
eventually() {
  local deadline=$((SECONDS + 20))
  while :; do
    call "$2" GET "$3"
    if [[ "$STATUS" == 200 ]] && jq -e "$4" <<<"$BODY" >/dev/null 2>&1; then
      pass "$1"
      return
    fi
    (( SECONDS < deadline )) || fail "$1 (GET $3, waited 20s)" "$BODY"
    sleep 1
  done
}

echo "Smoke test: $GATEWAY (origin $ORIGIN)"

request "gateway health" GET /health

request "sign up" POST /api/auth/sign-up/email \
  "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"Smoke Test\"}"

request "session" GET /api/auth/get-session
[[ "$(jq -r '.user.email' <<<"$BODY")" == "$EMAIL" ]] || fail "session user matches" "$BODY"
USER_ID="$(jq -r '.user.id' <<<"$BODY")"

request "profile" GET /api/v1/user/profile

# identity-service publishes user.registered.v1; code-service creates the starter project
eventually "starter project created (event)" "$JAR" /api/v1/code 'map(.name) | index("Welcome") != null'

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

# Sign-out must take effect immediately, although the gateway had cached the session:
# a copy of the old cookie is rejected on the next request.
cp "$JAR" "$OLD_JAR"
request "sign out" POST /api/auth/sign-out '{}'
expect_status "old cookie rejected after sign-out" 401 "$OLD_JAR" GET /api/v1/user/profile
request "sign in again" POST /api/auth/sign-in/email "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"

# Ban: needs an admin, i.e. SMOKE_ADMIN_EMAIL listed in ADMIN_EMAILS (CI uses the .env.example values)
ADMIN_BODY="{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"Smoke Admin\"}"
call "$ADMIN_JAR" POST /api/auth/sign-in/email "$ADMIN_BODY"
[[ "$STATUS" =~ ^2 ]] || call "$ADMIN_JAR" POST /api/auth/sign-up/email "$ADMIN_BODY"
call "$ADMIN_JAR" GET /api/v1/user/profile
if [[ "$STATUS" == 200 && "$(jq -r '.isAdmin' <<<"$BODY")" == "true" ]]; then
  # Contest (contest-service): the admin opens one, the user gets a strike and submits
  NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  expect_status "admin creates contest" 201 "$ADMIN_JAR" POST /api/v1/contest \
    "{\"title\":\"Smoke contest\",\"startTime\":\"$NOW\",\"endTime\":\"$NOW\"}"
  CONTEST_ID="$(jq -r '._id' <<<"$BODY")"
  expect_status "admin activates contest" 200 "$ADMIN_JAR" PATCH "/api/v1/contest/$CONTEST_ID/status" '{"status":"active"}'
  request "active contest" GET /api/v1/contest/active
  [[ "$(jq -r '._id' <<<"$BODY")" == "$CONTEST_ID" ]] || fail "active contest is ours" "$BODY"

  request "strike (old /warning path)" POST "/api/v1/code/warning/$PROJECT_ID"
  [[ "$(jq -r '.warningCount' <<<"$BODY")" == 1 ]] || fail "strike count is 1" "$BODY"
  # strike.recorded.v1 -> code-service copies the count onto the project
  eventually "project shows the strike (event)" "$JAR" "/api/v1/code/$PROJECT_ID" '.warningCount == 1'

  request "profile before ban (session cached)" GET /api/v1/user/profile
  request "submit project" POST /api/v1/code/submit \
    "{\"projectId\":\"$PROJECT_ID\",\"html\":\"<h1>final</h1>\",\"css\":\"\",\"js\":\"\",\"timeTaken\":60}"
  jq -e --arg c "$CONTEST_ID" '.warningCount == 1 and .contestId == $c' <<<"$BODY" >/dev/null \
    || fail "submission records strikes and contest" "$BODY"
  expect_status "admin bans user" 200 "$ADMIN_JAR" POST "/api/v1/user/admin/$USER_ID/ban"
  expect_status "banned user's next request rejected" 401 "$JAR" GET /api/v1/user/profile
  expect_status "banned user cannot sign in" 403 "$JAR" POST /api/auth/sign-in/email \
    "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
  eventually "submission disqualified (event)" "$ADMIN_JAR" "/api/v1/code/admin/submissions/$USER_ID" \
    'length > 0 and all(.disqualified == true)'
  expect_status "admin unbans user" 200 "$ADMIN_JAR" POST "/api/v1/user/admin/$USER_ID/unban"
  request "sign in after unban" POST /api/auth/sign-in/email "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
  request "profile after unban" GET /api/v1/user/profile
  eventually "submission reinstated (event)" "$ADMIN_JAR" "/api/v1/code/admin/submissions/$USER_ID" \
    'length > 0 and all(.disqualified == false)'
  expect_status "admin deletes contest" 200 "$ADMIN_JAR" DELETE "/api/v1/contest/$CONTEST_ID"
else
  printf '  - ban checks skipped: %s is not an admin (add it to ADMIN_EMAILS)\n' "$ADMIN_EMAIL"
fi

echo "All smoke checks passed ($EMAIL)"
