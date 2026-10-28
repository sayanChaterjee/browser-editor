import { PORTS, userTokenKeys } from '../test/env';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { verifyUserToken } from '@ceditor/common';
import { proxyServices } from './services';
import { listen } from '../test/http';

// Each upstream echoes which service received the request, at which path, and the headers
// the gateway attached (internal secret, user token, any plain identity header).
function upstream(service: string) {
  const app = express();
  app.use((req, res) => {
    res.json({
      service,
      method: req.method,
      url: req.originalUrl,
      secret: req.headers['x-internal-secret'] ?? null,
      userToken: req.headers['x-user-token'] ?? null,
      userIdHeader: req.headers['x-user-id'] ?? null,
    });
  });
  return app;
}

// Stands in for authMiddleware: x-test-user marks the request as signed in
const USER = { id: 'u-42', name: 'Ada', email: 'ada@example.com' };

const servers: Awaited<ReturnType<typeof listen>>[] = [];
let gateway: Awaited<ReturnType<typeof listen>>;

before(async () => {
  servers.push(await listen(upstream('identity-service'), PORTS.identity));
  servers.push(await listen(upstream('code-service'), PORTS.code));
  servers.push(await listen(upstream('contest-service'), PORTS.contest));
  const app = express();
  app.use((req, res, next) => {
    if (req.headers['x-test-user']) req.user = USER;
    next();
  });
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
  ['POST', '/api/v1/contest/submissions', 'contest-service', '/contest/submissions'],
  ['POST', '/api/v1/contest/strikes/p1', 'contest-service', '/contest/strikes/p1'],
  ['GET', '/api/v1/contest/admin/submissions/u1', 'contest-service', '/contest/admin/submissions/u1'],
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

// Each service gets a token signed for itself, so one service can't replay it at another
const audiences: [string, string][] = [
  ['/api/v1/user/profile', 'identity-service'],
  ['/api/v1/code/p1', 'code-service'],
  ['/api/v1/contest/active', 'contest-service'],
];

for (const [path, audience] of audiences) {
  test(`${path}: the user arrives as a token signed for ${audience}`, async () => {
    const body = await (await fetch(`${gateway.base}${path}`, { headers: { 'x-test-user': '1' } })).json();
    assert.deepEqual(verifyUserToken(userTokenKeys.publicKey, body.userToken, audience), USER);
    assert.equal(body.userIdHeader, null, 'no plain identity headers');
  });
}

test('identity headers sent by the client never reach a service', async () => {
  const forged = { 'x-user-id': 'admin', 'x-user-token': 'forged' };

  const anonymous = await (await fetch(`${gateway.base}/api/auth/get-session`, { headers: forged })).json();
  assert.equal(anonymous.userToken, null);
  assert.equal(anonymous.userIdHeader, null);

  const signedIn = await (await fetch(`${gateway.base}/api/v1/code/p1`, { headers: { ...forged, 'x-test-user': '1' } })).json();
  assert.equal(verifyUserToken(userTokenKeys.publicKey, signedIn.userToken, 'code-service').id, 'u-42');
  assert.equal(signedIn.userIdHeader, null);
});
