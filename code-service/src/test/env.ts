// Imported first by every code-service test: config is read when modules load, so the
// environment has to be in place before anything else is imported.
import { generateKeyPairSync } from 'crypto';
import { signUserToken } from '@ceditor/common';

const userTokenKeys = generateKeyPairSync('ed25519');

/** A token the gateway would send for this user (what verifyToken accepts). */
export const userTokenFor = (id: string, audience = 'code-service', role: 'user' | 'admin' = 'user') =>
  signUserToken(userTokenKeys.privateKey, { id, name: 'Test User', email: `${id}@example.com`, role }, audience);

Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
  INTERNAL_GATEWAY_SECRET: 'test-internal-secret',
  USER_TOKEN_PUBLIC_KEY: userTokenKeys.publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
  DATABASE_URL: process.env.MONGO_TEST_URL?.replace(/\/[^/]*$/, '/code_test') ?? 'mongodb://127.0.0.1:1/code_test',
  REDIS_URL: process.env.REDIS_TEST_URL ?? 'redis://127.0.0.1:1',
});

export const skip = process.env.MONGO_TEST_URL && process.env.REDIS_TEST_URL ? false : 'MONGO_TEST_URL and REDIS_TEST_URL not set';
