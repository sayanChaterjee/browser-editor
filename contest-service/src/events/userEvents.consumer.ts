import { createEventHandler, ManagedConsumer } from '@ceditor/common';
import { parseEvent, TOPICS, UserEvent } from '@ceditor/contracts';
import { kafka, producer } from '../config/kafka';
import logger from '../config/logger';
import { eventsConsumed } from '../config/metrics';
import { setDisqualified } from '../domain/attempts';
import ProcessedEvent from '../models/processedEvent.model';

const GROUP_ID = 'contest-service.user-events';

// Bans disqualify a user's submissions; unbans reinstate them. Both are safe to repeat.
async function handleUserEvent(event: UserEvent): Promise<void> {
  if (event.type === 'user.banned.v1' || event.type === 'user.unbanned.v1') {
    const disqualified = event.type === 'user.banned.v1';
    const changed = await setDisqualified(event.data.userId, disqualified);
    logger.info(`${disqualified ? 'Disqualified' : 'Reinstated'} ${changed} submission(s) of user ${event.data.userId}`);
  }
}

const consumer = new ManagedConsumer(kafka, {
  name: 'User events consumer',
  groupId: GROUP_ID,
  // A new group replays the retained history; applying it in order leaves each user's
  // submissions in the state of their latest ban/unban
  topics: [{ topic: TOPICS.userEvents, fromBeginning: true }],
  eachMessage: createEventHandler({
    groupId: GROUP_ID,
    logger,
    parse: (raw) => parseEvent(UserEvent, raw),
    handle: handleUserEvent,
    processed: {
      has: async (eventId) => (await ProcessedEvent.exists({ _id: eventId })) !== null,
      add: async (eventId, type) => {
        await ProcessedEvent.updateOne({ _id: eventId }, { $setOnInsert: { type } }, { upsert: true });
      },
    },
    deadLetter: { producer, topic: TOPICS.deadLetter },
    onOutcome: (topic, result, type = 'unknown') => eventsConsumed.inc({ topic, type, result }),
  }),
  logger,
});

// Kafka isn't needed to serve HTTP: both connect in the background with retries.
export const startKafka = () => {
  producer.start();
  consumer.start();
};

export const isKafkaConnected = () => consumer.isConnected();

export const stopKafka = async () => {
  await consumer.stop();
  await producer.stop();
};
