// Shared helpers for k6 scenarios.
import http from 'k6/http';
import { check, fail } from 'k6';

export const GATEWAY = __ENV.GATEWAY || 'http://localhost:3000';
export const ORIGIN = __ENV.ORIGIN || 'http://localhost:3005';

// Each simulated user gets its own client IP (the gateway trusts X-Forwarded-For),
// so the per-IP rate limiter sees distinct users, as it would in production.
export function fakeIp(n) {
  return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
}

export function headers(user, extra = {}) {
  return Object.assign(
    {
      Origin: ORIGIN,
      Cookie: user.cookie,
      'X-Forwarded-For': user.ip,
    },
    extra,
  );
}

// Signs up `count` fresh users and returns their session cookies (used in setup()).
// Each run uses a random IP block, so earlier runs' rate-limit counters don't carry over.
export function createUsers(count, prefix) {
  const run = Date.now();
  const ipBase = Math.floor(Math.random() * 250) * 65536;
  const users = [];
  for (let i = 0; i < count; i++) {
    const ip = fakeIp(ipBase + i + 1);
    const res = http.post(
      `${GATEWAY}/api/auth/sign-up/email`,
      JSON.stringify({
        email: `${prefix}-${run}-${i}@loadtest.local`,
        password: 'Load-Test-123!',
        name: `${prefix} ${i}`,
      }),
      { headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Forwarded-For': ip } },
    );
    if (res.status !== 200) {
      fail(`sign-up ${i} failed: ${res.status} ${res.body}`);
    }
    const cookie = Object.entries(res.cookies)
      .map(([name, values]) => `${name}=${values[0].value}`)
      .join('; ');
    users.push({ cookie, ip });
  }
  return users;
}

export function ok(res, name) {
  return check(res, { [`${name} 2xx`]: (r) => r.status >= 200 && r.status < 300 });
}
