import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, z, envRequired, envNumber, envBoolean, envList } from './config';

const schema = z.object({
  DATABASE_URL: envRequired('MongoDB connection string'),
  PORT: envNumber(3000),
  ENABLED: envBoolean(false),
  ORIGINS: envList('http://a,http://b'),
});

const failOnExit = (code: number): never => {
  throw new Error(`exit ${code}`);
};

test('applies defaults and converts types', () => {
  const config = loadConfig(schema, { DATABASE_URL: 'mongodb://x', ENABLED: 'true', ORIGINS: ' http://c , ,http://d' }, failOnExit);
  assert.deepEqual(config, { DATABASE_URL: 'mongodb://x', PORT: 3000, ENABLED: true, ORIGINS: ['http://c', 'http://d'] });
});

test('treats empty values as unset', () => {
  const config = loadConfig(schema, { DATABASE_URL: 'mongodb://x', PORT: '' }, failOnExit);
  assert.equal(config.PORT, 3000);
});

test('reports every problem at once, then exits with code 1', (t) => {
  const errors = t.mock.method(console, 'error', () => undefined);
  assert.throws(() => loadConfig(schema, { PORT: 'abc', ENABLED: 'yes' }, failOnExit), /exit 1/);

  const output = String(errors.mock.calls[0].arguments[0]);
  assert.match(output, /DATABASE_URL: required \(MongoDB connection string\)/);
  assert.match(output, /PORT:/);
  assert.match(output, /ENABLED:/);
});

test('missing and empty required values show the same hint', (t) => {
  const errors = t.mock.method(console, 'error', () => undefined);
  assert.throws(() => loadConfig(schema, {}, failOnExit));
  assert.throws(() => loadConfig(schema, { DATABASE_URL: '' }, failOnExit));
  for (const call of errors.mock.calls) {
    assert.match(String(call.arguments[0]), /DATABASE_URL: required \(MongoDB connection string\)/);
  }
});
