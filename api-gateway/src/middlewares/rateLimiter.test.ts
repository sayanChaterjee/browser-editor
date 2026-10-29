import '../test/env';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { FallbackStore } from './rateLimiter.middleware';
import redis from '../config/redis';
import { listen } from '../test/http';

// A limiter with the gateway's store: counts in Redis, and in memory while Redis is down.
const skip = process.env.REDIS_TEST_URL ? false : 'REDIS_TEST_URL not set';
const prefix = `rl:test-${randomUUID().slice(0, 8)}:`;

const app = express();
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 3,
    store: new FallbackStore(prefix, 'test'),
    keyGenerator: (req) => String(req.headers['x-client']),
    validate: false,
  }),
);
app.get('/', (req, res) => res.json({ ok: true }));

let server: Awaited<ReturnType<typeof listen>>;

before(async () => {
  server = await listen(app);
  if (!skip && redis.status !== 'ready') await new Promise((resolve) => redis.once('ready', resolve));
});

after(async () => {
  await server.close();
  redis.disconnect();
});

const hit = async (client: string) => (await fetch(server.base, { headers: { 'x-client': client } })).status;

test('with Redis up, counts are kept in Redis', { skip }, async () => {
  assert.deepEqual([await hit('a'), await hit('a'), await hit('a'), await hit('a')], [200, 200, 200, 429]);
  assert.equal(await redis.get(`${prefix}a`), '4');
});

test('with Redis down, the limit still holds (counted in memory)', { skip }, async () => {
  const ended = new Promise((resolve) => redis.once('end', resolve));
  redis.disconnect();
  await ended;
  try {
    assert.deepEqual([await hit('b'), await hit('b'), await hit('b'), await hit('b')], [200, 200, 200, 429]);
    assert.equal(await hit('c'), 200, 'other clients have their own count');
  } finally {
    await redis.connect();
  }
});
