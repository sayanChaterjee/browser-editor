import { createEventHandler, createKafka, ManagedConsumer, ManagedProducer } from '@ceditor/common';
import { AnyEvent, parseEvent, TOPICS } from '@ceditor/contracts';
import { config } from '../config';
import logger from '../config/logger';
import { eventsConsumed } from '../config/metrics';
import ProcessedEvent from '../models/processedEvent.model';
import { handleEvent } from './handlers';

// The group id predates contest.events; kept so the group's committed offsets carry over
const GROUP_ID = 'code-service.user-events';

const kafka = createKafka({ clientId: config.SERVICE_NAME, broker: config.KAFKA_BROKER, logger });

const deadLetterProducer = new ManagedProducer(kafka, { name: 'Dead-letter producer', logger });

const consumer = new ManagedConsumer(kafka, {
  name: 'Events consumer',
  groupId: GROUP_ID,
  // A new consumer group starts at the oldest retained event; duplicates are skipped
  topics: [
    { topic: TOPICS.userEvents, fromBeginning: true },
    { topic: TOPICS.contestEvents, fromBeginning: true },
  ],
  eachMessage: createEventHandler({
    groupId: GROUP_ID,
    logger,
    parse: (raw) => parseEvent(AnyEvent, raw),
    handle: handleEvent,
    processed: {
      has: async (eventId) => (await ProcessedEvent.exists({ _id: eventId })) !== null,
      add: async (eventId, type) => {
        await ProcessedEvent.updateOne({ _id: eventId }, { $setOnInsert: { type } }, { upsert: true });
      },
    },
    deadLetter: { producer: deadLetterProducer, topic: TOPICS.deadLetter },
    onOutcome: (topic, result, type = 'unknown') => eventsConsumed.inc({ topic, type, result }),
  }),
  logger,
});

// Kafka isn't needed to serve HTTP: both connect in the background with retries.
export const startEventsConsumer = () => {
  deadLetterProducer.start();
  consumer.start();
};

export const isKafkaConnected = () => consumer.isConnected();

export const stopEventsConsumer = async () => {
  await consumer.stop();
  await deadLetterProducer.stop();
};
