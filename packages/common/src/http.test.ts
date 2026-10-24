import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'net';
import express from 'express';
import { correlationMiddleware, internalSecurity } from './middleware';
import { getCorrelationId } from './context';
import { healthRoutes } from './health';
import { createLogger } from './logger';

const logger = createLogger('test', 'error');

async function withServer(app: express.Express, fn: (base: string) => Promise<void>) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.close();
  }
}

test('correlation ID: propagated when sent, generated otherwise, visible in async code', async () => {
  const app = express();
  app.use(correlationMiddleware);
  app.get('/', async (req, res) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    res.json({ fromContext: getCorrelationId() });
  });

  await withServer(app, async (base) => {
    const sent = await fetch(base, { headers: { 'x-correlation-id': 'abc-123' } });
    assert.equal(sent.headers.get('x-correlation-id'), 'abc-123');
    assert.deepEqual(await sent.json(), { fromContext: 'abc-123' });

    const generated = await fetch(base);
    const id = generated.headers.get('x-correlation-id');
    assert.match(id ?? '', /^[0-9a-f-]{36}$/);
    assert.deepEqual(await generated.json(), { fromContext: id });
  });
});

test('internal security: only the gateway secret gets through', async () => {
  const app = express();
  app.use(internalSecurity('s3cret', logger));
  app.get('/', (req, res) => res.send('ok'));

  await withServer(app, async (base) => {
    assert.equal((await fetch(base)).status, 403);
    assert.equal((await fetch(base, { headers: { 'x-internal-secret': 'wrong' } })).status, 403);
    assert.equal((await fetch(base, { headers: { 'x-internal-secret': 's3cret' } })).status, 200);
  });
});

test('internal security: a missing secret fails closed', async () => {
  const app = express();
  app.use(internalSecurity('', logger));
  app.get('/', (req, res) => res.send('ok'));

  await withServer(app, async (base) => {
    assert.equal((await fetch(base, { headers: { 'x-internal-secret': '' } })).status, 500);
  });
});

test('readiness: required dependencies gate it, optional ones are only reported', async () => {
  let mongoUp = true;
  const app = express();
  app.use(healthRoutes('svc', {
    mongo: { isUp: () => mongoUp, required: true },
    kafka: { isUp: () => false, required: false },
  }));

  await withServer(app, async (base) => {
    assert.equal((await fetch(`${base}/health`)).status, 200);

    const ready = await fetch(`${base}/ready`);
    assert.equal(ready.status, 200);
    assert.deepEqual(await ready.json(), { status: 'ready', service: 'svc', checks: { mongo: 'up', kafka: 'down' } });

    mongoUp = false;
    const notReady = await fetch(`${base}/ready`);
    assert.equal(notReady.status, 503);
    assert.equal((await notReady.json()).status, 'not_ready');
  });
});
