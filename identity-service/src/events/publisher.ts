import { EventPublisher, getCorrelationId } from '@ceditor/common';
import { createEvent, TOPICS, UserEvent } from '@ceditor/contracts';
import { config } from '../config';
import { producer } from '../config/kafka';
import logger from '../config/logger';
import { eventsPublished } from '../config/metrics';

const publisher = new EventPublisher(producer, logger, {
  onOutcome: (type, result) => eventsPublished.inc({ type, result }),
});

/**
 * Publishes a user event, keyed by userId so each user's events stay in order. Call only
 * after the change is committed; returns immediately (delivery is retried in the background).
 */
export function publishUserEvent<T extends UserEvent['type']>(type: T, data: Extract<UserEvent, { type: T }>['data']): void {
  const event = createEvent(type, data, {
    source: config.SERVICE_NAME,
    correlationId: getCorrelationId(),
  });
  publisher.publish(TOPICS.userEvents, data.userId, event);
}
