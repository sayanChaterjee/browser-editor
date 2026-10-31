import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MEMORY_TTL_MS, clearMemorySessions, forgetInMemory, fromMemory, rememberInMemory } from './memorySessionCache';

const ada = { userId: 'u-ada', name: 'Ada', email: 'ada@example.com', role: 'user' as const };
const now = Date.UTC(2026, 0, 1);
const inOneDay = new Date(now + 86_400_000);

beforeEach(clearMemorySessions);

test('kept for MEMORY_TTL_MS at most', () => {
  rememberInMemory('cookie-a', ada, inOneDay, now);
  assert.deepEqual(fromMemory('cookie-a', now + MEMORY_TTL_MS - 1), ada);
  assert.equal(fromMemory('cookie-a', now + MEMORY_TTL_MS), null);
});

test("never past the session's own expiry", () => {
  rememberInMemory('cookie-b', ada, new Date(now + 5_000), now);
  assert.equal(fromMemory('cookie-b', now + 5_000), null);
  rememberInMemory('cookie-c', ada, new Date(now - 1), now);
  assert.equal(fromMemory('cookie-c', now), null, 'an expired session is not stored');
});

test('forgetting a user drops all their sessions', () => {
  rememberInMemory('cookie-d1', ada, inOneDay, now);
  rememberInMemory('cookie-d2', ada, inOneDay, now);
  rememberInMemory('cookie-e', { ...ada, userId: 'u-bob' }, inOneDay, now);
  forgetInMemory('u-ada');
  assert.equal(fromMemory('cookie-d1', now), null);
  assert.equal(fromMemory('cookie-d2', now), null);
  assert.equal(fromMemory('cookie-e', now)?.userId, 'u-bob');
});
