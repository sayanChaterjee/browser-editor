import { PORTS } from '../test/env';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { proxyServices } from './services';
import { listen } from '../test/http';

// Each upstream echoes which service received the request, at which path, and whether the
// gateway's internal secret came with it.
function upstream(service: string) {
  const app = express();
  app.use((req, res) => {
    res.json({ service, method: req.method, url: req.originalUrl, secret: req.headers['x-internal-secret'] ?? null });
  });
  return app;
}

const servers: Awaited<ReturnType<typeof listen>>[] = [];
let gateway: Awaited<ReturnType<typeof listen>>;

before(async () => {
  servers.push(await listen(upstream('identity-service'), PORTS.identity));
  servers.push(await listen(upstream('code-service'), PORTS.code));
  servers.push(await listen(upstream('contest-service'), PORTS.contest));
  const app = express();
  proxyServices(app);
  gateway = await listen(app);
});

after(async () => {
  await gateway.close();
  await Promise.all(servers.map((s) => s.close()));
});

const routes: [string, string, string, string][] = [
  // method, gateway path, expected service, expected upstream path
  ['GET', '/api/auth/get-session', 'identity-service', '/api/auth/get-session'],
  ['GET', '/api/v1/user/profile', 'identity-service', '/users/profile'],
  ['POST', '/api/v1/user/admin/u1/ban', 'identity-service', '/users/admin/u1/ban'],
  ['GET', '/api/v1/code', 'code-service', '/'],
  ['GET', '/api/v1/code/p1', 'code-service', '/p1'],
  ['POST', '/api/v1/code/save', 'code-service', '/save'],
  ['GET', '/api/v1/code/admin/projects/u1', 'code-service', '/admin/projects/u1'],
  ['GET', '/api/v1/contest/active', 'contest-service', '/contest/active'],
  ['PATCH', '/api/v1/contest/c1/status', 'contest-service', '/contest/c1/status'],
  // Old contest paths the frontend still calls under /api/v1/code
  ['POST', '/api/v1/code/submit', 'contest-service', '/contest/submissions'],
  ['POST', '/api/v1/code/warning/p1', 'contest-service', '/contest/strikes/p1'],
  ['GET', '/api/v1/code/admin/submissions/u1', 'contest-service', '/contest/admin/submissions/u1'],
];

for (const [method, path, service, upstreamPath] of routes) {
  test(`${method} ${path} -> ${service} ${upstreamPath}`, async () => {
    const res = await fetch(`${gateway.base}${path}`, { method });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.service, service);
    assert.equal(body.method, method);
    assert.equal(body.url.split('?')[0].replace(/\/$/, '') || '/', upstreamPath);
    assert.equal(body.secret, 'test-internal-secret', 'internal secret forwarded');
  });
}
