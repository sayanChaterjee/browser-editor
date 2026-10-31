import mongoose, { ClientSession } from 'mongoose';
import { enqueueEvent, getCorrelationId, OutboxRelay } from '@ceditor/common';
import { createEvent, TOPICS, UserEvent } from '@ceditor/contracts';
import { config } from '../config';
import { producer } from '../config/kafka';
import logger from '../config/logger';
import { eventsPublished } from '../config/metrics';

/** Sends saved user events to Kafka (started with the service; see @ceditor/common outbox). */
export const outboxRelay = new OutboxRelay(() => mongoose.connection.db, producer, logger, {
  onOutcome: (type, result) => eventsPublished.inc({ type, result }),
});

/**
 * Saves a user event to the outbox, keyed by userId so each user's events stay in order. Pass
 * the transaction's session to commit it with the change it describes. The relay sends it;
 * wake it after the commit to send at once.
 */
export async function publishUserEvent<T extends UserEvent['type']>(
  type: T,
  data: Extract<UserEvent, { type: T }>['data'],
  session?: ClientSession,
): Promise<void> {
  const event = createEvent(type, data, { source: config.SERVICE_NAME, correlationId: getCorrelationId() });
  await enqueueEvent(mongoose.connection.db!, TOPICS.userEvents, data.userId, event, session);
}
