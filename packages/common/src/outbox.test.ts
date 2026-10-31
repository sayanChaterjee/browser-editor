import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import { Db, MongoClient } from 'mongodb';
import { OUTBOX_COLLECTION, OutboxRelay, enqueueEvent, ensureOutboxIndexes } from './outbox';
import { createLogger } from './logger';

// Needs MongoDB as a replica set (transactions): CI provides one; locally e.g.
// MONGO_TEST_URL=mongodb://localhost:27017/x npm test -w @ceditor/common
const url = process.env.MONGO_TEST_URL;
const skip = url ? false : 'MONGO_TEST_URL not set';
const logger = createLogger('test', 'error');
let client: MongoClient;
let db: Db;

before(async () => {
  if (!url) return;
  client = await MongoClient.connect(url);
  db = client.db('outbox_test');
  await db.dropDatabase();
  await ensureOutboxIndexes(db);
});

after(async () => {
  if (!url) return;
  await db.dropDatabase();
  await client.close();
});

beforeEach(async () => {
  if (url) await db.collection(OUTBOX_COLLECTION).deleteMany({});
});

const event = (type = 'test.happened.v1') => ({ eventId: randomUUID(), type, occurredAt: new Date().toISOString() });

// A Kafka stand-in that records what was sent, and can be told to fail
function fakeProducer() {
  const sent: { topic: string; key: string; type: string }[] = [];
  let failing = false;
  return {
    sent,
    fail: (on: boolean) => { failing = on; },
    send: async ({ topic, messages }: { topic: string; messages: { key?: unknown; value: unknown }[] }) => {
      if (failing) throw new Error('broker down');
      for (const m of messages) sent.push({ topic, key: String(m.key), type: JSON.parse(String(m.value)).type });
    },
  };
}

test('an event saved in a committed transaction is sent and marked published', { skip }, async () => {
  const producer = fakeProducer();
  const relay = new OutboxRelay(() => db, producer, logger);
  const session = client.startSession();
  await session.withTransaction(async () => {
    await db.collection('things').insertOne({ name: 'thing' }, { session });
    await enqueueEvent(db, 'topic-a', 'user-1', event('thing.created.v1'), session);
  });
  await session.endSession();

  await relay.wake();
  assert.deepEqual(producer.sent, [{ topic: 'topic-a', key: 'user-1', type: 'thing.created.v1' }]);
  const record = await db.collection(OUTBOX_COLLECTION).findOne({});
  assert.ok(record!.publishedAt instanceof Date);

  await relay.wake();
  assert.equal(producer.sent.length, 1, 'not sent again');
});

test('an aborted transaction leaves neither the change nor the event', { skip }, async () => {
  const session = client.startSession();
  await assert.rejects(
    session.withTransaction(async () => {
      await db.collection('things').insertOne({ name: 'doomed' }, { session });
      await enqueueEvent(db, 'topic-a', 'user-2', event(), session);
      throw new Error('something failed after the writes');
    }),
    /something failed/,
  );
  await session.endSession();
  assert.equal(await db.collection('things').countDocuments({ name: 'doomed' }), 0);
  assert.equal(await db.collection(OUTBOX_COLLECTION).countDocuments(), 0);
});

test('a failed send is retried later, and events go out oldest first', { skip }, async () => {
  const producer = fakeProducer();
  const relay = new OutboxRelay(() => db, producer, logger, { retry: { baseMs: 50, maxMs: 50 } });
  await enqueueEvent(db, 't', 'u', event('first.v1'));
  await enqueueEvent(db, 't', 'u', event('second.v1'));

  producer.fail(true);
  await relay.wake();
  const waiting = await db.collection(OUTBOX_COLLECTION).find({}).sort({ createdAt: 1 }).toArray();
  assert.equal(waiting[0].attempts, 1);
  assert.match(waiting[0].lastError, /broker down/);
  assert.equal(waiting[1].attempts, 0, 'stops at the first failure: later events keep their turn');

  producer.fail(false);
  await new Promise((resolve) => setTimeout(resolve, 80)); // past the back-off
  await relay.wake();
  assert.deepEqual(producer.sent.map((s) => s.type), ['first.v1', 'second.v1']);
});

test('two relays at once send each event exactly once', { skip }, async () => {
  const producer = fakeProducer();
  for (let i = 0; i < 40; i++) await enqueueEvent(db, 't', `u${i % 3}`, event(`e${i}.v1`));
  const a = new OutboxRelay(() => db, producer, logger);
  const b = new OutboxRelay(() => db, producer, logger);
  await Promise.all([a.wake(), b.wake()]);
  assert.equal(producer.sent.length, 40);
  assert.equal(new Set(producer.sent.map((s) => s.type)).size, 40);
  assert.equal(await db.collection(OUTBOX_COLLECTION).countDocuments({ publishedAt: null }), 0);
});
