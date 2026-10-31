import type { ClientSession, Collection, Db } from 'mongodb';
import type { EventSender } from './events';
import type { Logger } from './logger';
import { backoffDelay, RetryOptions } from './retry';

/**
 * Transactional outbox: an event is written to the `outbox` collection in the same MongoDB
 * transaction as the change it describes, so either both are saved or neither is. A relay then
 * sends saved events to Kafka and marks them published, retrying until it works. A crash
 * between the commit and the send can no longer lose an event; at worst the relay sends it
 * twice, which consumers already handle (they skip event ids they have processed).
 *
 * Several instances can run relays: each record is leased while being sent.
 */

export const OUTBOX_COLLECTION = 'outbox';
// Published records are kept a week (for inspection), then removed by a TTL index
const KEEP_PUBLISHED_SECONDS = 7 * 24 * 3600;

interface EventLike {
  eventId: string;
  type: string;
}

export interface OutboxRecord {
  _id: string; // the event id
  topic: string;
  key: string;
  type: string;
  value: string; // the serialized event
  createdAt: Date;
  availableAt: Date; // not sent before this (back-off after a failure)
  lockedUntil: Date | null; // lease held by a relay that is sending it
  publishedAt: Date | null;
  attempts: number;
  lastError?: string;
}

const outbox = (db: Db): Collection<OutboxRecord> => db.collection<OutboxRecord>(OUTBOX_COLLECTION);

/** Saves an event for the relay. Pass the transaction's session so it commits with the change. */
export async function enqueueEvent(db: Db, topic: string, key: string, event: EventLike, session?: ClientSession) {
  const now = new Date();
  await outbox(db).insertOne(
    {
      _id: event.eventId,
      topic,
      key,
      type: event.type,
      value: JSON.stringify(event),
      createdAt: now,
      availableAt: now,
      lockedUntil: null,
      publishedAt: null,
      attempts: 0,
    },
    { session },
  );
}

export async function ensureOutboxIndexes(db: Db) {
  await outbox(db).createIndex({ publishedAt: 1, availableAt: 1, createdAt: 1 });
  await outbox(db).createIndex(
    { publishedAt: 1 },
    { name: 'published_ttl', expireAfterSeconds: KEEP_PUBLISHED_SECONDS, partialFilterExpression: { publishedAt: { $type: 'date' } } },
  );
}

export interface OutboxRelayOptions {
  intervalMs?: number;
  leaseMs?: number;
  retry?: RetryOptions;
  onOutcome?: (type: string, result: 'published' | 'failed') => void;
}

/** Sends saved events to Kafka, oldest first, and marks them published. */
export class OutboxRelay {
  private timer: NodeJS.Timeout | null = null;
  private draining: Promise<void> | null = null;
  private again = false;

  constructor(
    private readonly db: () => Db | undefined,
    private readonly producer: EventSender,
    private readonly logger: Logger,
    private readonly options: OutboxRelayOptions = {},
  ) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.wake(), this.options.intervalMs ?? 1000);
    this.timer.unref?.();
    this.wake();
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.draining;
  }

  /** Sends what's waiting now (call after a commit); runs at most one drain at a time. */
  wake(): Promise<void> {
    if (this.draining) {
      this.again = true;
      return this.draining;
    }
    const run: Promise<void> = this.drain()
      .catch((err) => {
        this.logger.error(`Outbox relay: ${(err as Error).message}`);
      })
      .finally(() => {
        this.draining = null;
        if (this.again) {
          this.again = false;
          void this.wake();
        }
      });
    this.draining = run;
    return run;
  }

  /** Publishes until nothing is due; stops at the first failure so later events wait their turn. */
  private async drain() {
    const db = this.db();
    if (!db) return;
    const { leaseMs = 30_000, retry = { baseMs: 1000, maxMs: 60_000 }, onOutcome } = this.options;

    for (;;) {
      const now = new Date();
      const record = await outbox(db).findOneAndUpdate(
        { publishedAt: null, availableAt: { $lte: now }, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }] },
        { $set: { lockedUntil: new Date(now.getTime() + leaseMs) } },
        { sort: { createdAt: 1 }, returnDocument: 'after' },
      );
      if (!record) return;

      try {
        await this.producer.send({ topic: record.topic, messages: [{ key: record.key, value: record.value }] });
        await outbox(db).updateOne({ _id: record._id }, { $set: { publishedAt: new Date(), lockedUntil: null } });
        onOutcome?.(record.type, 'published');
      } catch (err) {
        const attempts = record.attempts + 1;
        const delay = backoffDelay(attempts, retry);
        await outbox(db).updateOne(
          { _id: record._id },
          { $set: { attempts, availableAt: new Date(Date.now() + delay), lockedUntil: null, lastError: (err as Error).message } },
        );
        onOutcome?.(record.type, 'failed');
        this.logger.warn(`Outbox: sending ${record.type} ${record._id} failed (attempt ${attempts}), retrying in ${delay}ms: ${(err as Error).message}`);
        return;
      }
    }
  }
}
