import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backoffDelay, retryInBackground } from './retry';

test('backoff doubles from the base and is capped', () => {
  const delays = [1, 2, 3, 4, 5, 6, 7].map((attempt) => backoffDelay(attempt));
  assert.deepEqual(delays, [1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  assert.equal(backoffDelay(3, { baseMs: 10, maxMs: 25 }), 25);
});

test('retries until the task succeeds, reporting each failure', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const failures: [string, number, number][] = [];
  let done!: () => void;
  const finished = new Promise<void>((resolve) => (done = resolve));

  retryInBackground(
    async () => {
      calls++;
      if (calls < 3) throw new Error(`boom ${calls}`);
      done();
    },
    (err, attempt, delay) => failures.push([err.message, attempt, delay]),
    { baseMs: 100 },
  );

  for (let i = 0; i < 2; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    t.mock.timers.tick(1000);
  }
  await finished;

  assert.equal(calls, 3);
  assert.deepEqual(failures, [
    ['boom 1', 1, 100],
    ['boom 2', 2, 200],
  ]);
});

test('cancelling stops further attempts', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const cancel = retryInBackground(
    async () => {
      calls++;
      throw new Error('down');
    },
    () => undefined,
  );

  await new Promise((resolve) => setImmediate(resolve));
  cancel();
  t.mock.timers.tick(60000);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls, 1);
});
