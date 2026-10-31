// Imported first by tests that load the service's config (e.g. the real event publisher):
// config is read when modules load, so the environment has to be in place before anything else.
import { generateKeyPairSync } from 'crypto';

Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
  INTERNAL_GATEWAY_SECRET: 'test-internal-secret',
  USER_TOKEN_PUBLIC_KEY: generateKeyPairSync('ed25519').publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
  DATABASE_URL: process.env.MONGO_TEST_URL ?? 'mongodb://127.0.0.1:1/contest_test',
  KAFKA_BROKER: '127.0.0.1:1',
});
