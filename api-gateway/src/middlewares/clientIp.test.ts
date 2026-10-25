import '../test/env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { clientIpMiddleware } from './clientIp.middleware';
import { listen } from '../test/http';

// The resolved IP keys the per-IP rate limits, so spoofable headers must never win.
function app() {
  const a = express();
  a.use(clientIpMiddleware);
  a.get('/', (req, res) => {
    res.json({
      clientIp: req.clientIp,
      bffSecret: req.headers['x-bff-secret'] ?? null,
      clientIpHeader: req.headers['x-client-ip'] ?? null,
    });
  });
  return a;
}

async function resolve(headers: Record<string, string>) {
  const server = await listen(app());
  try {
    return await (await fetch(server.base, { headers })).json();
  } finally {
    await server.close();
  }
}

test('the frontend proxy, proven by the shared secret, supplies the client IP', async () => {
  const body = await resolve({ 'x-bff-secret': 'test-bff-secret', 'x-client-ip': '203.0.113.7', 'cf-connecting-ip': '198.51.100.1' });
  assert.equal(body.clientIp, '203.0.113.7');
});

test('a wrong secret is ignored: falls back to Cloudflare', async () => {
  const body = await resolve({ 'x-bff-secret': 'guess', 'x-client-ip': '203.0.113.7', 'cf-connecting-ip': '198.51.100.1' });
  assert.equal(body.clientIp, '198.51.100.1');
});

test('x-client-ip without the secret is ignored', async () => {
  const body = await resolve({ 'x-client-ip': '203.0.113.7' });
  assert.equal(body.clientIp, '127.0.0.1');
});

test('X-Forwarded-For is never trusted for the client IP', async () => {
  const body = await resolve({ 'x-forwarded-for': '203.0.113.99' });
  assert.equal(body.clientIp, '127.0.0.1');
});

test('the proxy headers are stripped before reaching downstream services', async () => {
  const body = await resolve({ 'x-bff-secret': 'test-bff-secret', 'x-client-ip': '203.0.113.7' });
  assert.equal(body.bffSecret, null);
  assert.equal(body.clientIpHeader, null);
});
