import { randomUUID } from 'crypto';
import { z } from 'zod';

/**
 * Every event shares this envelope. `type` carries the version (`user.registered.v1`): a
 * breaking change to `data` means a new type, published alongside the old one until every
 * consumer has moved over.
 */
export const envelope = <T extends string, D extends z.ZodTypeAny>(type: T, data: D) =>
  z.object({
    // Unique per event: consumers use it to skip redeliveries
    eventId: z.string().uuid(),
    type: z.literal(type),
    occurredAt: z.string().datetime(),
    // Service that published the event
    source: z.string().min(1),
    // Request that caused it, to follow one action across services in the logs
    correlationId: z.string().optional(),
    data,
  });

export interface EventMetadata {
  source: string;
  correlationId?: string;
}

export interface BaseEvent<T extends string = string, D = unknown> {
  eventId: string;
  type: T;
  occurredAt: string;
  source: string;
  correlationId?: string;
  data: D;
}

/** Builds an event with a fresh id and timestamp. */
export function createEvent<T extends string, D>(type: T, data: D, meta: EventMetadata): BaseEvent<T, D> {
  return {
    eventId: randomUUID(),
    type,
    occurredAt: new Date().toISOString(),
    source: meta.source,
    ...(meta.correlationId ? { correlationId: meta.correlationId } : {}),
    data,
  };
}

/** A message that isn't a valid event (bad JSON, unknown type, wrong shape); never worth retrying. */
export class InvalidEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEventError';
  }
}

/** Parses a raw message against a schema, throwing InvalidEventError with the reason. */
export function parseEvent<S extends z.ZodTypeAny>(schema: S, raw: string | Buffer | null | undefined): z.infer<S> {
  if (!raw || raw.length === 0) throw new InvalidEventError('empty message');
  let json: unknown;
  try {
    json = JSON.parse(raw.toString());
  } catch {
    throw new InvalidEventError('not JSON');
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new InvalidEventError(`${issue.path.join('.') || 'event'}: ${issue.message}`);
  }
  return result.data;
}
