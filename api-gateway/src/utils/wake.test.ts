import { PORTS } from '../test/env';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { wakeServices } from './wake';
import { listen } from '../test/http';

// Fake services count the /health requests they get
const hits: Record<string, number> = {};
const servers: Awaited<ReturnType<typeof listen>>[] = [];

before(async () => {
  for (const [name, port] of Object.entries(PORTS)) {
    const app = express();
    app.get('/health', (req, res) => {
      hits[name] = (hits[name] ?? 0) + 1;
      res.send('OK');
    });
    servers.push(await listen(app, port));
  }
});

after(async () => {
  await Promise.all(servers.map((s) => s.close()));
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

test('wakes every service, then at most once a minute however often it is asked', async () => {
  const start = Date.now();
  assert.deepEqual(wakeServices(start).sort(), ['code-service', 'contest-service', 'identity-service']);
  assert.deepEqual(wakeServices(start + 1_000), [], 'a second page within the minute adds no traffic');
  await settle();
  assert.deepEqual(hits, { identity: 1, code: 1, contest: 1 });

  assert.equal(wakeServices(start + 61_000).length, 3, 'a minute later they are pinged again');
  await settle();
  assert.deepEqual(hits, { identity: 2, code: 2, contest: 2 });
});
