import { EventPublisher, getCorrelationId } from '@ceditor/common';
import { ContestEvent, createEvent, TOPICS } from '@ceditor/contracts';
import { config } from '../config';
import { producer } from '../config/kafka';
import logger from '../config/logger';
import { eventsPublished } from '../config/metrics';

const publisher = new EventPublisher(producer, logger, {
  onOutcome: (type, result) => eventsPublished.inc({ type, result }),
});

export type PublishContestEvent = <T extends ContestEvent['type']>(
  type: T,
  data: Extract<ContestEvent, { type: T }>['data'],
) => void;

/**
 * Publishes a contest event, keyed by userId so each user's events stay in order. Call only
 * after the change is committed; returns immediately (delivery is retried in the background).
 */
export const publishContestEvent: PublishContestEvent = (type, data) => {
  const event = createEvent(type, data, { source: config.SERVICE_NAME, correlationId: getCorrelationId() });
  publisher.publish(TOPICS.contestEvents, data.userId, event);
};
