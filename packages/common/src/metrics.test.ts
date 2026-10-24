import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'net';
import express from 'express';
import { createMetrics, registerDependencyGauge } from './metrics';

async function withServer(app: express.Express, fn: (base: string) => Promise<void>) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.close();
  }
}

function appWith(token: string) {
  const metrics = createMetrics('svc', { token });
  const app = express();
  app.use(metrics.httpMetrics);
  app.use(metrics.metricsRoute);
  app.get('/items/:id', (req, res) => res.send('ok'));
  return { app, metrics };
}

test('/metrics is disabled without a token and requires the right bearer token', async () => {
  await withServer(appWith('').app, async (base) => {
    assert.equal((await fetch(`${base}/metrics`)).status, 404);
  });

  await withServer(appWith('t0ken').app, async (base) => {
    assert.equal((await fetch(`${base}/metrics`)).status, 401);
    assert.equal((await fetch(`${base}/metrics`, { headers: { authorization: 'Bearer nope' } })).status, 401);
    assert.equal((await fetch(`${base}/metrics`, { headers: { authorization: 'Bearer t0ken' } })).status, 200);
  });
});

test('records requests by route pattern, not raw path', async () => {
  const { app } = appWith('t0ken');
  await withServer(app, async (base) => {
    await fetch(`${base}/items/1`);
    await fetch(`${base}/items/2`);
    await fetch(`${base}/missing`);

    const body = await (await fetch(`${base}/metrics`, { headers: { authorization: 'Bearer t0ken' } })).text();
    assert.match(body, /http_request_duration_seconds_count\{[^}]*route="\/items\/:id"[^}]*status_code="200"[^}]*\} 2/);
    assert.match(body, /http_request_duration_seconds_count\{[^}]*route="unmatched"[^}]*status_code="404"[^}]*\} 1/);
    assert.doesNotMatch(body, /route="\/items\/1"/);
    assert.match(body, /service="svc"/);
  });
});

test('dependency gauge mirrors readiness checks', async () => {
  const { app, metrics } = appWith('t0ken');
  let redisUp = true;
  registerDependencyGauge(metrics, { redis: { isUp: () => redisUp, required: true } });

  await withServer(app, async (base) => {
    const read = async () =>
      (await fetch(`${base}/metrics`, { headers: { authorization: 'Bearer t0ken' } })).text();
    assert.match(await read(), /dependency_up\{dependency="redis",required="true",service="svc"\} 1/);
    redisUp = false;
    assert.match(await read(), /dependency_up\{dependency="redis",required="true",service="svc"\} 0/);
  });
});
