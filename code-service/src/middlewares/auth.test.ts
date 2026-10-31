import { userTokenFor } from '../test/env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'net';
import { generateKeyPairSync } from 'crypto';
import express from 'express';
import { signUserToken } from '@ceditor/common';
import { verifyToken } from './auth.middleware';

// The user must come from a token the gateway signed for code-service; anything else is 401,
// even from a caller that holds the internal secret.
async function whoAmI(headers: Record<string, string>) {
  const app = express();
  app.get('/', verifyToken, (req, res) => res.json({ userId: req.userId, email: req.userEmail, role: req.userRole }));
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`, { headers });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

test('a token signed for code-service identifies the user', async () => {
  const res = await whoAmI({ 'x-user-token': userTokenFor('u-1') });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { userId: 'u-1', email: 'u-1@example.com', role: 'user' });
  const admin = await whoAmI({ 'x-user-token': userTokenFor('u-2', 'code-service', 'admin') });
  assert.equal(admin.body.role, 'admin', 'the role comes from the signed token');
});

test('plain x-user-* headers are not trusted', async () => {
  assert.equal((await whoAmI({ 'x-user-id': 'admin', 'x-user-email': 'admin@example.com' })).status, 401);
});

test('a token for another service is refused', async () => {
  assert.equal((await whoAmI({ 'x-user-token': userTokenFor('u-1', 'contest-service') })).status, 401);
});

test('a token signed with any other key is refused', async () => {
  const forged = signUserToken(generateKeyPairSync('ed25519').privateKey, { id: 'admin', name: '', email: 'admin@example.com', role: 'admin' }, 'code-service');
  assert.equal((await whoAmI({ 'x-user-token': forged })).status, 401);
});
