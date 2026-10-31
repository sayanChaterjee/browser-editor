import mongoose, { ClientSession } from 'mongoose';
import { enqueueEvent, getCorrelationId, OutboxRelay } from '@ceditor/common';
import { ContestEvent, createEvent, TOPICS } from '@ceditor/contracts';
import { config } from '../config';
import { producer } from '../config/kafka';
import logger from '../config/logger';
import { eventsPublished } from '../config/metrics';

/** Sends saved contest events to Kafka (started with the service; see @ceditor/common outbox). */
export const outboxRelay = new OutboxRelay(() => mongoose.connection.db, producer, logger, {
  onOutcome: (type, result) => eventsPublished.inc({ type, result }),
});

export type PublishContestEvent = <T extends ContestEvent['type']>(
  type: T,
  data: Extract<ContestEvent, { type: T }>['data'],
  session?: ClientSession,
) => Promise<void>;

/**
 * Saves a contest event to the outbox, keyed by userId so each user's events stay in order.
 * Pass the transaction's session: the event then commits (or not) with the change it
 * describes. The relay sends it to Kafka; wake it after the commit to send at once.
 */
export const publishContestEvent: PublishContestEvent = async (type, data, session) => {
  const event = createEvent(type, data, { source: config.SERVICE_NAME, correlationId: getCorrelationId() });
  await enqueueEvent(mongoose.connection.db!, TOPICS.contestEvents, data.userId, event, session);
};
