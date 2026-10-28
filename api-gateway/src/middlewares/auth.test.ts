import { PORTS } from '../test/env';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { authMiddleware, sessionCacheInvalidation, stripClientIdentity } from './auth.middleware';
import redis from '../config/redis';
import { listen } from '../test/http';

// Session checks against a fake identity-service and a real Redis (session cache).
const skip = process.env.REDIS_TEST_URL ? false : 'REDIS_TEST_URL not set';

const COOKIE = 'better-auth.session_token';
const run = randomUUID().slice(0, 8);
const token = (name: string) => `${name}-${run}`;

// Fake identity-service: the session token decides the answer
let identityCalls = 0;
const identity = express();
identity.get('/api/auth/get-session', (req, res) => {
  identityCalls++;
  assert.equal(req.query.disableCookieCache, 'true', 'must bypass Better Auth cookie cache');
  const cookie = String(req.headers.cookie ?? '');
  const user = (id: string, extra = {}) => ({
    session: { expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
    user: { id, name: 'Test User', email: 'Test@Example.com', ...extra },
  });
  if (cookie.includes('hang-up')) return req.socket.destroy();
  if (cookie.includes('banned')) return res.json(user('u-banned', { banned: true }));
  if (cookie.includes('valid')) return res.json(user(`u-${cookie.split('valid-')[1]?.slice(0, 20)}`));
  res.json(null);
});

// Gateway slice: cookie parsing, invalidation on /api/auth, auth on /api/v1
const gateway = express();
gateway.use(cookieParser());
gateway.use(stripClientIdentity);
gateway.use('/api/auth', sessionCacheInvalidation, (req, res) => res.json({ ok: true }));
gateway.use('/api/v1', authMiddleware, (req, res) => {
  res.json({ userId: req.user?.id, email: req.user?.email, clientHeaders: [req.headers['x-user-id'], req.headers['x-user-token']] });
});

let identityServer: Awaited<ReturnType<typeof listen>>;
let gatewayServer: Awaited<ReturnType<typeof listen>>;

before(async () => {
  identityServer = await listen(identity, PORTS.identity);
  gatewayServer = await listen(gateway);
  if (!skip && redis.status !== 'ready') await new Promise((resolve) => redis.once('ready', resolve));
});

after(async () => {
  await identityServer.close();
  await gatewayServer.close();
  redis.disconnect();
});

async function call(path: string, cookie?: string, init: RequestInit = {}) {
  const headers: Record<string, string> = cookie ? { cookie: `${COOKIE}=${cookie}` } : {};
  const res = await fetch(`${gatewayServer.base}${path}`, { ...init, headers: { ...headers, ...(init.headers as object) } });
  return { status: res.status, body: await res.json() };
}

test('no session cookie: 401 without asking identity-service', { skip }, async () => {
  const before = identityCalls;
  assert.equal((await call('/api/v1/x')).status, 401);
  assert.equal(identityCalls, before);
});

test('a valid session is checked once, then served from the cache', { skip }, async () => {
  const cookie = token('valid-a');
  const before = identityCalls;

  const first = await call('/api/v1/x', cookie);
  assert.equal(first.status, 200);
  assert.match(first.body.userId, /^u-a-/);
  assert.equal(first.body.email, 'test@example.com', 'email is lower-cased');

  // The cache write is fire-and-forget; give it a moment
  await new Promise((resolve) => setTimeout(resolve, 50));
  const second = await call('/api/v1/x', cookie);
  assert.equal(second.status, 200);
  assert.equal(identityCalls - before, 1, 'second request came from the cache');
});

test('client-sent identity headers are dropped; the user comes from the session', { skip }, async () => {
  const res = await call('/api/v1/x', token('valid-b'), {
    headers: { 'x-user-id': 'admin', 'x-user-email': 'admin@example.com', 'x-user-token': 'forged' },
  });
  assert.match(res.body.userId, /^u-b-/);
  assert.equal(res.body.email, 'test@example.com');
  assert.deepEqual(res.body.clientHeaders, [null, null]);
});

test('invalid sessions are rejected and never cached', { skip }, async () => {
  const cookie = token('nobody');
  const before = identityCalls;
  assert.equal((await call('/api/v1/x', cookie)).status, 401);
  assert.equal((await call('/api/v1/x', cookie)).status, 401);
  assert.equal(identityCalls - before, 2);
});

test('a banned user is rejected even if identity-service returns the session', { skip }, async () => {
  assert.equal((await call('/api/v1/x', token('banned'))).status, 401);
});

test('identity-service unreachable: 503, not 401 (a 401 would sign the user out)', { skip }, async () => {
  const res = await call('/api/v1/x', token('hang-up'));
  assert.equal(res.status, 503);
});

test('sign-out drops the cached session immediately', { skip }, async () => {
  const cookie = token('valid-c');
  await call('/api/v1/x', cookie);
  await new Promise((resolve) => setTimeout(resolve, 50));
  const before = identityCalls;

  assert.equal((await call('/api/auth/sign-out', cookie, { method: 'POST' })).status, 200);
  await call('/api/v1/x', cookie);
  assert.equal(identityCalls - before, 1, 'after sign-out the session is checked again');
});

test('Redis down: sessions are checked at identity-service instead', { skip }, async () => {
  // disconnect() returns before the connection is closed; wait, so the request really runs
  // without Redis (and connect() below doesn't find it still connected)
  const ended = new Promise((resolve) => redis.once('end', resolve));
  redis.disconnect();
  await ended;
  try {
    assert.equal(redis.status, 'end');
    const before = identityCalls;
    assert.equal((await call('/api/v1/x', token('valid-d'))).status, 200);
    assert.equal(identityCalls - before, 1);
  } finally {
    await redis.connect();
  }
});
