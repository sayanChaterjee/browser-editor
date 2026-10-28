// Imported first by every gateway test: config is read when modules load, so the
// environment has to be in place before anything else is imported.
import { generateKeyPairSync } from 'crypto';

export const PORTS = { identity: 47101, code: 47103, contest: 47104 };

// The gateway signs user tokens with this; tests verify them with userTokenKeys.publicKey
export const userTokenKeys = generateKeyPairSync('ed25519');

Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
  INTERNAL_GATEWAY_SECRET: 'test-internal-secret',
  USER_TOKEN_PRIVATE_KEY: userTokenKeys.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
  BFF_SHARED_SECRET: 'test-bff-secret',
  TRUST_CF_CONNECTING_IP: 'true',
  REDIS_URL: process.env.REDIS_TEST_URL ?? 'redis://127.0.0.1:1',
  IDENTITY_SERVICE_URL: `http://127.0.0.1:${PORTS.identity}`,
  CODE_SERVICE_URL: `http://127.0.0.1:${PORTS.code}`,
  CONTEST_SERVICE_URL: `http://127.0.0.1:${PORTS.contest}`,
});
