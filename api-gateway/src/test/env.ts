// Imported first by every gateway test: config is read when modules load, so the
// environment has to be in place before anything else is imported.
export const PORTS = { identity: 47101, code: 47103, contest: 47104 };

Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
  INTERNAL_GATEWAY_SECRET: 'test-internal-secret',
  BFF_SHARED_SECRET: 'test-bff-secret',
  TRUST_CF_CONNECTING_IP: 'true',
  REDIS_URL: process.env.REDIS_TEST_URL ?? 'redis://127.0.0.1:1',
  IDENTITY_SERVICE_URL: `http://127.0.0.1:${PORTS.identity}`,
  CODE_SERVICE_URL: `http://127.0.0.1:${PORTS.code}`,
  CONTEST_SERVICE_URL: `http://127.0.0.1:${PORTS.contest}`,
});
