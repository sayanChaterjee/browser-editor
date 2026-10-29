import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Redis from 'ioredis';
import { createLoginLockout } from './loginLockout';

// Needs a real Redis (Lua script, TTLs): CI provides one; locally e.g.
// REDIS_TEST_URL=redis://localhost:6379/15 npm test -w @ceditor/common
const url = process.env.REDIS_TEST_URL;
const skip = url ? false : 'REDIS_TEST_URL not set';
let redis: Redis;

before(async () => {
  if (!url) return;
  redis = new Redis(url);
  await redis.flushdb();
});

after(async () => {
  await redis?.quit();
});

const options = { maxFailures: 3, windowSeconds: 900 };

test('an address locks after maxFailures, for the rest of the window', { skip }, async () => {
  const lockout = createLoginLockout(redis, options);
  for (let i = 0; i < 2; i++) await lockout.recordFailure('ada@example.com');
  assert.equal((await lockout.status('ada@example.com')).locked, false);

  await lockout.recordFailure('ada@example.com');
  const status = await lockout.status('ADA@example.com ');
  assert.equal(status.locked, true, 'case and whitespace don\'t make a new address');
  assert.ok(status.retryAfterSeconds > 890 && status.retryAfterSeconds <= 900, `retry after ${status.retryAfterSeconds}`);

  assert.equal((await lockout.status('bob@example.com')).locked, false, 'other addresses unaffected');
  assert.equal((await redis.keys('*ada*')).length, 0, 'the address never appears in a key');
});

test('more failures don\'t extend the lock', { skip }, async () => {
  const lockout = createLoginLockout(redis, options);
  const before = new Set(await redis.keys('login-failures:*'));
  for (let i = 0; i < 3; i++) await lockout.recordFailure('cy@example.com');
  const key = (await redis.keys('login-failures:*')).find((k) => !before.has(k))!;
  await redis.expire(key, 100);
  await lockout.recordFailure('cy@example.com');
  assert.ok((await redis.ttl(key)) <= 100);
});

test('a successful sign-in clears the count', { skip }, async () => {
  const lockout = createLoginLockout(redis, options);
  for (let i = 0; i < 2; i++) await lockout.recordFailure('dee@example.com');
  await lockout.clear('dee@example.com');
  for (let i = 0; i < 2; i++) await lockout.recordFailure('dee@example.com');
  assert.equal((await lockout.status('dee@example.com')).locked, false);
});

test('Redis down: lockout keeps working in memory, and reports the fallback', async () => {
  // Never connects: status stays 'wait'/'reconnecting', never 'ready'
  const down = new Redis('redis://127.0.0.1:1', { lazyConnect: true, enableOfflineQueue: false });
  const fallbacks: string[] = [];
  const lockout = createLoginLockout(down, options, (operation) => fallbacks.push(operation));

  for (let i = 0; i < 3; i++) await lockout.recordFailure('eve@example.com');
  const status = await lockout.status('eve@example.com');
  assert.equal(status.locked, true);
  assert.ok(status.retryAfterSeconds > 890);
  assert.equal((await lockout.status('fay@example.com')).locked, false);

  await lockout.clear('eve@example.com');
  assert.equal((await lockout.status('eve@example.com')).locked, false);
  assert.ok(fallbacks.includes('recordFailure') && fallbacks.includes('status'));
  down.disconnect();
});
