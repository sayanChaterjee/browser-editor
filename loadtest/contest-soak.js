// Scenario: a contest in progress. Every user autosaves every 10s (useEditorPersistence),
// which is the app's sustained peak load and exercises the Redis write-behind path.
// Run: see loadtest/README.md
import http from 'k6/http';
import { sleep } from 'k6';
import { GATEWAY, createUsers, headers, ok } from './lib/common.js';

const USERS = Number(__ENV.USERS || 100);
const SAVE_INTERVAL = Number(__ENV.SAVE_INTERVAL || 10);

export const options = {
  setupTimeout: '10m',
  scenarios: {
    contest_soak: {
      executor: 'constant-vus',
      vus: USERS,
      duration: __ENV.DURATION || '5m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{endpoint:save}': ['p(95)<200'],
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  return { users: createUsers(USERS, 'contest') };
}

export default function ({ users }) {
  const user = users[(__VU - 1) % users.length];
  const code = `<h1>attempt ${__ITER}</h1>`.repeat(20); // ~0.5 KB, a small realistic edit

  ok(
    http.post(
      `${GATEWAY}/api/v1/code/save`,
      JSON.stringify({ name: 'contest-entry', html: code, css: 'h1{color:red}', js: 'console.log(1)', timeLeft: 3600 }),
      { headers: headers(user, { 'Content-Type': 'application/json' }), tags: { endpoint: 'save' } },
    ),
    'save',
  );

  sleep(SAVE_INTERVAL);
}
