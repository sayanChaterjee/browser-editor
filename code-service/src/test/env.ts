// Imported first by every code-service test: config is read when modules load, so the
// environment has to be in place before anything else is imported.
Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
  INTERNAL_GATEWAY_SECRET: 'test-internal-secret',
  DATABASE_URL: process.env.MONGO_TEST_URL?.replace(/\/[^/]*$/, '/code_test') ?? 'mongodb://127.0.0.1:1/code_test',
  REDIS_URL: process.env.REDIS_TEST_URL ?? 'redis://127.0.0.1:1',
});

export const skip = process.env.MONGO_TEST_URL && process.env.REDIS_TEST_URL ? false : 'MONGO_TEST_URL and REDIS_TEST_URL not set';
