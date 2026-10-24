// Scenario: users opening the editor (the 4 requests useProjectManager makes on load).
// Run: see loadtest/README.md
import http from 'k6/http';
import { check, sleep } from 'k6';
import { GATEWAY, createUsers, headers, ok } from './lib/common.js';

const USERS = Number(__ENV.USERS || 50);

export const options = {
  setupTimeout: '5m',
  scenarios: {
    editor_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP || '1m', target: USERS },
        { duration: __ENV.HOLD || '3m', target: USERS },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{endpoint:profile}': ['p(95)<500'],
    'http_req_duration{endpoint:projects}': ['p(95)<500'],
    'http_req_duration{endpoint:project}': ['p(95)<500'],
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  const users = createUsers(USERS, 'editor');
  // Give every user one project so "open project" has something to load.
  users.forEach((u) => {
    const res = http.post(
      `${GATEWAY}/api/v1/code/save`,
      JSON.stringify({ name: 'main', html: '<h1>hi</h1>', css: '', js: '' }),
      { headers: headers(u, { 'Content-Type': 'application/json' }) },
    );
    u.projectId = res.json('_id');
  });
  return { users };
}

export default function ({ users }) {
  const user = users[(__VU - 1) % users.length];

  // 404 = "no active contest", which the frontend treats as a normal answer.
  const contest = http.get(`${GATEWAY}/api/v1/contest/active`, {
    headers: headers(user),
    tags: { endpoint: 'contest_active' },
    responseCallback: http.expectedStatuses(200, 404),
  });
  check(contest, { 'contest active 200/404': (r) => r.status === 200 || r.status === 404 });
  ok(http.get(`${GATEWAY}/api/v1/user/profile`, { headers: headers(user), tags: { endpoint: 'profile' } }), 'profile');
  ok(http.get(`${GATEWAY}/api/v1/code`, { headers: headers(user), tags: { endpoint: 'projects' } }), 'projects');
  ok(http.get(`${GATEWAY}/api/v1/code/${user.projectId}`, { headers: headers(user), tags: { endpoint: 'project' } }), 'project');

  // Think time between editor opens.
  sleep(Math.random() * 3 + 2);
}
