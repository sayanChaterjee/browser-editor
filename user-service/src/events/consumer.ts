import { EachMessagePayload } from 'kafkajs';
import { createKafka, ManagedConsumer, ManagedProducer } from '@ceditor/common';
import { config } from '../config';
import User from '../models/user.model';
import logger from '../config/logger';

const kafka = createKafka({ clientId: config.SERVICE_NAME, broker: config.KAFKA_BROKER, logger });

const dlqProducer = new ManagedProducer(kafka, { name: 'User DLQ producer', logger });

const handleMessage = async ({ topic, message }: EachMessagePayload) => {
  if (topic !== 'user-registered') return;

  const value = message.value?.toString();
  if (!value) return;

  let data;
  try {
    data = JSON.parse(value);
  } catch (err) {
    logger.error('Failed to parse Kafka message', err);
    return;
  }

  // Processing with Retry Strategy
  const MAX_RETRIES = 5;
  let attempt = 0;
  let success = false;
  let lastError: any = null;

  while (attempt < MAX_RETRIES && !success) {
    try {
      attempt++;
      if (!data.userId) {
        throw new Error('Invalid user-registered payload: missing userId');
      }

      logger.info(`[${topic}] Processing sync attempt ${attempt}/${MAX_RETRIES} for ${data.userId}`);

      await User.findOneAndUpdate(
        { _id: data.userId },
        {
          $set: {
            name: data.name,
          },
        },
        { upsert: true, new: true, runValidators: true }
      );

      logger.info(`[${topic}] User ${data.userId} synced successfully on attempt ${attempt}`);
      success = true;
    } catch (err: any) {
      lastError = err;
      logger.error(`[${topic}] Sync attempt ${attempt} failed: ${err.message}`);

      if (attempt < MAX_RETRIES) {
        const jitter = Math.random() * 1000;
        const delay = Math.pow(2, attempt) * 1000 + jitter;
        logger.info(`[${topic}] Retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  if (!success) {
    logger.error(`[${topic}] Message failed after ${MAX_RETRIES} attempts. Sending to DLQ. Reason: ${lastError?.message || 'Unknown'}`);
    await dlqProducer.send({
      topic: 'user-registered-dlq',
      messages: [
        {
          key: message.key,
          value: JSON.stringify({
            originalPayload: data,
            error: lastError?.message || 'Failed after max retries',
            failedAt: new Date().toISOString(),
            retryAttempts: MAX_RETRIES
          })
        }
      ]
    });
  }
};

const consumer = new ManagedConsumer(kafka, {
  name: 'Kafka consumer',
  groupId: 'user-service-group',
  topics: [{ topic: 'user-registered', fromBeginning: process.env.NODE_ENV !== 'production' }],
  eachMessage: handleMessage,
  logger,
});

// Kafka isn't needed to serve HTTP: both connect in the background with retries.
export const startConsumer = () => {
  dlqProducer.start();
  consumer.start();
};

export const isKafkaConnected = () => consumer.isConnected();

export const disconnectConsumer = async () => {
  await consumer.stop();
  await dlqProducer.stop();
};
