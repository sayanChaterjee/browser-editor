import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'crypto';
import {
  InvalidUserTokenError,
  privateKeyFromBase64,
  publicKeyFromBase64,
  publicKeyToBase64,
  signUserToken,
  USER_TOKEN_TTL_SECONDS,
  verifyUserToken,
} from './userToken';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const user = { id: 'u1', name: 'Ada', email: 'Ada@Example.com' };
const now = Date.UTC(2026, 0, 1);

const rejects = (token: string, reason: RegExp, audience = 'code-service', at = now) =>
  assert.throws(() => verifyUserToken(publicKey, token, audience, at), (err: Error) => err instanceof InvalidUserTokenError && reason.test(err.message));

test('a token signed for a service verifies there and names the user', () => {
  const token = signUserToken(privateKey, user, 'code-service', now);
  assert.deepEqual(verifyUserToken(publicKey, token, 'code-service', now), { id: 'u1', name: 'Ada', email: 'ada@example.com' });
});

test('keys survive the one-line base64 form used in env vars', () => {
  const priv = privateKeyFromBase64(privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'));
  const pub = publicKeyFromBase64(publicKeyToBase64(publicKey));
  assert.equal(verifyUserToken(pub, signUserToken(priv, user, 'a', now), 'a', now).id, 'u1');
});

test('a token for one service is refused by another', () => {
  rejects(signUserToken(privateKey, user, 'contest-service', now), /another service/);
});

test('expired tokens are refused (after the TTL plus a few seconds of clock skew)', () => {
  const token = signUserToken(privateKey, user, 'code-service', now);
  assert.equal(verifyUserToken(publicKey, token, 'code-service', now + USER_TOKEN_TTL_SECONDS * 1000).id, 'u1');
  rejects(token, /expired/, 'code-service', now + (USER_TOKEN_TTL_SECONDS + 10) * 1000);
});

test('tokens issued in the future are refused', () => {
  rejects(signUserToken(privateKey, user, 'code-service', now + 60_000), /future/);
});

test('a tampered payload fails the signature check', () => {
  const [header, , signature] = signUserToken(privateKey, user, 'code-service', now).split('.');
  const forged = Buffer.from(JSON.stringify({ iss: 'api-gateway', aud: 'code-service', sub: 'admin', iat: now / 1000, exp: now / 1000 + 60 })).toString('base64url');
  rejects(`${header}.${forged}.${signature}`, /signature/);
});

test('a token signed with another key is refused', () => {
  const other = generateKeyPairSync('ed25519').privateKey;
  rejects(signUserToken(other, user, 'code-service', now), /signature/);
});

test('"alg: none" and unsigned tokens are refused', () => {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const claims = part({ iss: 'api-gateway', aud: 'code-service', sub: 'admin', iat: now / 1000, exp: now / 1000 + 60 });
  rejects(`${part({ alg: 'none' })}.${claims}.`, /algorithm/);

  // Correct header, but a signature over something else
  const header = part({ alg: 'EdDSA', typ: 'JWT' });
  const wrong = sign(null, Buffer.from('other'), privateKey).toString('base64url');
  rejects(`${header}.${claims}.${wrong}`, /signature/);
});

test('garbage is refused', () => {
  rejects('not-a-token', /malformed/);
  rejects('a.b.c', /malformed/);
  const nullPart = Buffer.from('null').toString('base64url');
  rejects(`${nullPart}.${nullPart}.x`, /malformed/);
});
