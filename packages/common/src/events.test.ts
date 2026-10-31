import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { EachMessagePayload } from 'kafkajs';
import { ConsumeOutcome, createEventHandler, DEAD_LETTER_HEADERS, ProcessedEventStore } from './events';
import { createLogger } from './logger';
import { getCorrelationId } from './context';

const logger = createLogger('test', 'error');
const fast = { baseMs: 1, maxMs: 1 };

interface TestEvent {
  eventId: string;
  type: string;
  data: { userId: string };
}

function fakeProducer(failures = 0) {
  const sent: any[] = [];
  let toFail = failures;
  return {
    sent,
    async send(record: any) {
      if (toFail-- > 0) throw new Error('broker down');
      sent.push(record);
    },
  };
}

function memoryStore(): ProcessedEventStore & { ids: Set<string> } {
  const ids = new Set<string>();
  return { ids, has: async (id) => ids.has(id), add: async (id) => void ids.add(id) };
}

const parse = (raw: Buffer | null): TestEvent => {
  const event = JSON.parse(raw?.toString() ?? '');
  if (typeof event.eventId !== 'string') throw new Error('eventId missing');
  return event;
};

function payload(value: string | null, offset = '0'): EachMessagePayload {
  return {
    topic: 'user-events',
    partition: 0,
    message: { key: Buffer.from('u1'), value: value === null ? null : Buffer.from(value), offset, headers: {} },
    heartbeat: async () => {},
  } as unknown as EachMessagePayload;
}

const event = (eventId: string): TestEvent => ({ eventId, type: 'user.test.v1', data: { userId: 'u1' } });

function setup(handle: (e: TestEvent) => Promise<void>) {
  const dlq = fakeProducer();
  const processed = memoryStore();
  const outcomes: ConsumeOutcome[] = [];
  const handler = createEventHandler<TestEvent>({
    groupId: 'test-group',
    logger,
    parse,
    handle,
    processed,
    deadLetter: { producer: dlq, topic: 'dead-letter' },
    retry: fast,
    onOutcome: (_topic, outcome) => outcomes.push(outcome),
  });
  return { handler, dlq, processed, outcomes };
}

test('handles an event once, skipping redeliveries', async () => {
  let handled = 0;
  const { handler, processed, outcomes } = setup(async () => void handled++);

  await handler(payload(JSON.stringify(event('e1'))));
  await handler(payload(JSON.stringify(event('e1')), '1'));

  assert.equal(handled, 1);
  assert.ok(processed.ids.has('e1'));
  assert.deepEqual(outcomes, ['processed', 'duplicate']);
});

test('handlers run with the correlation ID of the request that caused the event', async () => {
  const seen: (string | undefined)[] = [];
  const { handler } = setup(async () => void seen.push(getCorrelationId()));

  await handler(payload(JSON.stringify({ ...event('e6'), correlationId: 'req-42' })));
  await handler(payload(JSON.stringify(event('e7'))));

  assert.deepEqual(seen, ['req-42', 'e7'], 'falls back to the event id');
});

test('malformed messages go straight to the dead-letter topic, with their origin', async () => {
  let handled = 0;
  const { handler, dlq, outcomes } = setup(async () => void handled++);

  await handler(payload('{not json', '42'));

  assert.equal(handled, 0);
  assert.deepEqual(outcomes, ['invalid']);
  const [record] = dlq.sent;
  assert.equal(record.topic, 'dead-letter');
  const headers = record.messages[0].headers;
  assert.equal(headers[DEAD_LETTER_HEADERS.sourceTopic], 'user-events');
  assert.equal(headers[DEAD_LETTER_HEADERS.sourceOffset], '42');
  assert.equal(headers[DEAD_LETTER_HEADERS.consumerGroup], 'test-group');
  assert.match(headers[DEAD_LETTER_HEADERS.error], /^invalid:/);
  assert.equal(record.messages[0].value.toString(), '{not json');
});

test('transient failures are retried; success is recorded once', async () => {
  let calls = 0;
  const { handler, dlq, processed, outcomes } = setup(async () => {
    if (++calls < 3) throw new Error('db down');
  });

  await handler(payload(JSON.stringify(event('e2'))));

  assert.equal(calls, 3);
  assert.equal(dlq.sent.length, 0);
  assert.ok(processed.ids.has('e2'));
  assert.deepEqual(outcomes, ['processed']);
});

test('an event that keeps failing is dead-lettered and not marked processed', async () => {
  let calls = 0;
  const { handler, dlq, processed, outcomes } = setup(async () => {
    calls++;
    throw new Error('db down');
  });

  await handler(payload(JSON.stringify(event('e3'))));

  assert.equal(calls, 5);
  assert.equal(processed.ids.has('e3'), false);
  assert.deepEqual(outcomes, ['dead_lettered']);
  assert.equal(dlq.sent[0].messages[0].headers[DEAD_LETTER_HEADERS.error], 'db down');
});
