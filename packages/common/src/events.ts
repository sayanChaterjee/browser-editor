import type { EachMessagePayload, IHeaders } from 'kafkajs';
import { runWithContext } from './context';
import type { Logger } from './logger';
import { backoffDelay, RetryOptions } from './retry';

// Event mechanics shared by producers and consumers. What the events contain lives in
// @ceditor/contracts; this module only moves them reliably.

/** The send side of a producer (ManagedProducer in services, a fake in tests). */
export interface EventSender {
  send(record: { topic: string; messages: { key?: string | Buffer | null; value: string | Buffer; headers?: IHeaders }[] }): Promise<unknown>;
}

interface EventLike {
  eventId: string;
  type: string;
  correlationId?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

export interface EventPublisherOptions {
  /** Attempts before the event is dropped (logged and counted). Default 8, ~2 min with backoff. */
  maxAttempts?: number;
  retry?: RetryOptions;
  onOutcome?: (type: string, outcome: 'published' | 'failed') => void;
}

/**
 * Publishes events after the change they describe is committed, retrying in the background
 * so callers never wait on Kafka or fail because of it.
 *
 * Trade-off (no outbox): an event still being retried is lost if the process stops, and one
 * that exhausts its attempts is dropped. Both are logged and counted (outcome "failed").
 */
export class EventPublisher {
  constructor(
    private readonly producer: EventSender,
    private readonly logger: Logger,
    private readonly options: EventPublisherOptions = {},
  ) {}

  publish(topic: string, key: string, event: EventLike): void {
    const { maxAttempts = 8, retry = { baseMs: 1000, maxMs: 60000 }, onOutcome } = this.options;
    const value = JSON.stringify(event);

    const attempt = async (n: number) => {
      try {
        await this.producer.send({ topic, messages: [{ key, value }] });
        onOutcome?.(event.type, 'published');
        this.logger.info(`Published ${event.type} ${event.eventId}`);
      } catch (err) {
        if (n >= maxAttempts) {
          onOutcome?.(event.type, 'failed');
          this.logger.error(`Dropped ${event.type} ${event.eventId} after ${n} attempts: ${errorMessage(err)}`);
          return;
        }
        const delay = backoffDelay(n, retry);
        this.logger.warn(`Publishing ${event.type} ${event.eventId} failed (attempt ${n}), retrying in ${delay}ms: ${errorMessage(err)}`);
        setTimeout(() => void attempt(n + 1), delay).unref();
      }
    };
    void attempt(1);
  }
}

/** Remembers handled events so redeliveries are skipped. */
export interface ProcessedEventStore {
  has(eventId: string): Promise<boolean>;
  add(eventId: string, type: string): Promise<void>;
}

// Headers on a dead-lettered message: where it came from and why it failed
export const DEAD_LETTER_HEADERS = {
  sourceTopic: 'x-source-topic',
  sourcePartition: 'x-source-partition',
  sourceOffset: 'x-source-offset',
  consumerGroup: 'x-consumer-group',
  error: 'x-error',
  failedAt: 'x-failed-at',
} as const;

export type ConsumeOutcome = 'processed' | 'duplicate' | 'invalid' | 'dead_lettered';

export interface EventHandlerOptions<E extends EventLike> {
  groupId: string;
  logger: Logger;
  /** Validates a raw message; any error means it's malformed (dead-lettered, never retried). */
  parse: (raw: Buffer | null) => E;
  /** Applies the event. Should be safe to run twice: a crash after it but before the event is recorded redelivers it. */
  handle: (event: E) => Promise<void>;
  processed: ProcessedEventStore;
  deadLetter: { producer: EventSender; topic: string };
  /** Attempts for transient failures (e.g. database down) before dead-lettering. Default 5. */
  maxAttempts?: number;
  retry?: RetryOptions;
  onOutcome?: (topic: string, outcome: ConsumeOutcome, type?: string) => void;
}

/**
 * Builds an eachMessage handler: parse -> skip if already processed -> handle with retries ->
 * record. Malformed messages and ones that keep failing go to the dead-letter topic, so one bad
 * message can't block the partition behind it. Messages are handled one at a time per partition,
 * keeping each key's (user's) events in order.
 */
export function createEventHandler<E extends EventLike>(options: EventHandlerOptions<E>) {
  const { groupId, logger, parse, handle, processed, deadLetter, onOutcome } = options;
  const { maxAttempts = 5, retry = { baseMs: 500, maxMs: 8000 } } = options;

  const sendToDeadLetter = async ({ topic, partition, message }: EachMessagePayload, reason: string) => {
    // If this send fails the error propagates: the offset isn't committed and the message is redelivered
    await deadLetter.producer.send({
      topic: deadLetter.topic,
      messages: [
        {
          key: message.key,
          value: message.value ?? '',
          headers: {
            ...message.headers,
            [DEAD_LETTER_HEADERS.sourceTopic]: topic,
            [DEAD_LETTER_HEADERS.sourcePartition]: String(partition),
            [DEAD_LETTER_HEADERS.sourceOffset]: message.offset,
            [DEAD_LETTER_HEADERS.consumerGroup]: groupId,
            [DEAD_LETTER_HEADERS.error]: reason.slice(0, 500),
            [DEAD_LETTER_HEADERS.failedAt]: new Date().toISOString(),
          },
        },
      ],
    });
  };

  const handleWithRetries = async (payload: EachMessagePayload, event: E): Promise<void> => {
    const { topic } = payload;
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (await processed.has(event.eventId)) {
          logger.info(`[${topic}] Skipping duplicate ${event.type} ${event.eventId}`);
          onOutcome?.(topic, 'duplicate', event.type);
          return;
        }
        await handle(event);
        await processed.add(event.eventId, event.type);
        logger.info(`[${topic}] Processed ${event.type} ${event.eventId}`);
        onOutcome?.(topic, 'processed', event.type);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxAttempts) {
          const delay = backoffDelay(attempt, retry);
          logger.warn(`[${topic}] ${event.type} ${event.eventId} failed (attempt ${attempt}), retrying in ${delay}ms: ${errorMessage(err)}`);
          await sleep(delay);
          // Long retries must not get this consumer evicted from its group
          await payload.heartbeat();
        }
      }
    }

    logger.error(`[${topic}] ${event.type} ${event.eventId} failed ${maxAttempts} times, dead-lettering: ${lastError?.message}`);
    await sendToDeadLetter(payload, lastError?.message ?? 'unknown error');
    onOutcome?.(topic, 'dead_lettered', event.type);
  };

  return async (payload: EachMessagePayload): Promise<void> => {
    const { topic, message } = payload;

    let event: E;
    try {
      event = parse(message.value);
    } catch (err) {
      logger.error(`[${topic}] Invalid message at offset ${message.offset}, dead-lettering: ${errorMessage(err)}`);
      await sendToDeadLetter(payload, `invalid: ${errorMessage(err)}`);
      onOutcome?.(topic, 'invalid');
      return;
    }

    // Logs while handling carry the correlation ID of the request that caused the event
    await runWithContext({ correlationId: event.correlationId ?? event.eventId }, () => handleWithRetries(payload, event));
  };
}
