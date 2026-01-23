import { Kafka, Producer } from 'kafkajs';
import { config } from '../config';
import User from '../models/user.model';
import logger from '../config/logger';

const kafka = new Kafka({
  clientId: config.SERVICE_NAME,
  brokers: [config.KAFKA_BROKER],
});

const consumer = kafka.consumer({ groupId: 'user-service-group' });
let dlqProducer: Producer;

export const startConsumer = async () => {
  try {
    dlqProducer = kafka.producer();
    await dlqProducer.connect();
    await consumer.connect();

    await consumer.subscribe({
      topic: 'user-registered',
      fromBeginning: process.env.NODE_ENV !== 'production',
    });

    logger.info('Kafka consumer connected and subscribed (with Retries & DLQ)');

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
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
        const MAX_RETRIES = 3;
        let attempt = 0;
        let success = false;

        while (attempt < MAX_RETRIES && !success) {
          try {
            attempt++;
            if (!data.userId || !data.email) {
              throw new Error('Invalid user-registered payload');
            }

            logger.info(`Processing ${topic} attempt ${attempt} for ${data.email}`);

            await User.findOneAndUpdate(
              { _id: data.userId },
              {
                $set: {
                  name: data.name,
                  email: data.email,
                },
              },
              { upsert: true, new: true }
            );

            logger.info(`User ${data.email} synced successfully on attempt ${attempt}`);
            success = true;
          } catch (err: any) {
            logger.error(`Error processing attempt ${attempt}: ${err.message}`);
            if (attempt < MAX_RETRIES) {
              const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }

        if (!success) {
          logger.error(`Message failed after ${MAX_RETRIES} attempts. Sending to DLQ.`);
          await dlqProducer.send({
            topic: 'user-registered-dlq',
            messages: [
              {
                key: message.key,
                value: JSON.stringify({
                  originalPayload: data,
                  error: 'Failed after max retries',
                  failedAt: new Date().toISOString()
                })
              }
            ]
          });
        }
      },
    });
  } catch (err) {
    logger.error('Kafka consumer failed to start', err);
    process.exit(1);
  }
};

export const disconnectConsumer = async () => {
  try {
    logger.info('Disconnecting Kafka consumer...');
    await consumer.disconnect();
    if (dlqProducer) await dlqProducer.disconnect();
    logger.info('Kafka consumer and DLQ producer disconnected');
  } catch (err) {
    logger.error('Error during Kafka disconnection', err);
  }
};
