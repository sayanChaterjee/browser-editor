import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEvent, InvalidEventError, parseEvent } from './envelope';
import { UserEvent, UserRegisteredV1 } from './userEvents';

const meta = { source: 'identity-service', correlationId: 'req-1' };

test('createEvent builds a valid envelope that round-trips through JSON', () => {
  const event = createEvent(
    'user.registered.v1',
    { userId: 'u1', name: 'Ada', registeredAt: new Date().toISOString() },
    meta,
  );
  assert.match(event.eventId, /^[0-9a-f-]{36}$/);
  assert.equal(event.source, 'identity-service');

  const parsed = parseEvent(UserEvent, JSON.stringify(event));
  assert.deepEqual(parsed, event);
});

test('events get distinct ids', () => {
  const data = { userId: 'u1', bannedBy: 'admin', bannedAt: new Date().toISOString() };
  const a = createEvent('user.banned.v1', data, meta);
  const b = createEvent('user.banned.v1', data, meta);
  assert.notEqual(a.eventId, b.eventId);
});

test('invalid messages are rejected with a reason', () => {
  const valid = createEvent(
    'user.banned.v1',
    { userId: 'u1', bannedBy: 'admin', bannedAt: new Date().toISOString() },
    meta,
  );
  const cases: [unknown, RegExp][] = [
    ['', /empty/],
    ['{oops', /not JSON/],
    [JSON.stringify({ ...valid, type: 'user.deleted.v1' }), /type/],
    [JSON.stringify({ ...valid, eventId: 'not-a-uuid' }), /eventId/],
    [JSON.stringify({ ...valid, data: { userId: 'u1' } }), /data\.bannedBy/],
  ];
  for (const [raw, reason] of cases) {
    assert.throws(() => parseEvent(UserEvent, raw as string), (err: Error) => {
      assert.ok(err instanceof InvalidEventError);
      assert.match(err.message, reason);
      return true;
    });
  }
});

test('an event of one type does not parse as another', () => {
  const banned = createEvent(
    'user.banned.v1',
    { userId: 'u1', bannedBy: 'admin', bannedAt: new Date().toISOString() },
    meta,
  );
  assert.throws(() => parseEvent(UserRegisteredV1, JSON.stringify(banned)), InvalidEventError);
});
