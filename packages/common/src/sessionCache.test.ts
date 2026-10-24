import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Redis from 'ioredis';
import { cacheSession, forgetUserSessions, getCachedSession } from './sessionCache';

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

const alice = { userId: 'u-alice', name: 'Alice', email: 'alice@example.com' };
const inOneDay = () => new Date(Date.now() + 24 * 3600 * 1000);

test('caches a session by cookie and reads it back', { skip }, async () => {
  assert.equal(await getCachedSession(redis, 'cookie-a1'), null);
  assert.equal(await cacheSession(redis, 'cookie-a1', alice, inOneDay()), true);
  assert.deepEqual(await getCachedSession(redis, 'cookie-a1'), alice);

  const ttl = await redis.ttl((await redis.keys('session-cache:token:*'))[0]);
  assert.ok(ttl >= 240 && ttl <= 300, `ttl ${ttl} should be 80-100% of 300s`);
  assert.equal((await redis.keys('*cookie-a1*')).length, 0, 'raw cookie never appears in a key');
});

test('forgetUserSessions drops every session of the user and blocks re-caching', { skip }, async () => {
  const carol = { ...alice, userId: 'u-carol' };
  await cacheSession(redis, 'cookie-c1', carol, inOneDay());
  await cacheSession(redis, 'cookie-c2', carol, inOneDay());
  await cacheSession(redis, 'cookie-other', alice, inOneDay());

  await forgetUserSessions(redis, 'u-carol');

  assert.equal(await getCachedSession(redis, 'cookie-c1'), null);
  assert.equal(await getCachedSession(redis, 'cookie-c2'), null);
  assert.ok(await getCachedSession(redis, 'cookie-other'), 'other users unaffected');

  // A session check that started before the ban must not re-cache the user
  assert.equal(await cacheSession(redis, 'cookie-c1', carol, inOneDay()), false);
  assert.equal(await getCachedSession(redis, 'cookie-c1'), null);
});

test('an entry never outlives its session', { skip }, async () => {
  const dave = { ...alice, userId: 'u-dave' };
  assert.equal(await cacheSession(redis, 'cookie-d1', dave, new Date(Date.now() + 20_000)), true);
  const ttl = await redis.ttl((await redis.smembers('session-cache:user:u-dave')).map((h) => `session-cache:token:${h}`)[0]);
  assert.ok(ttl > 0 && ttl <= 20, `ttl ${ttl} capped at the session's expiry`);

  assert.equal(await cacheSession(redis, 'cookie-d2', dave, new Date(Date.now() - 1000)), false, 'expired session');
  assert.equal(await getCachedSession(redis, 'cookie-d2'), null);
});
