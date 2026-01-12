import { Kafka } from 'kafkajs';
import { config } from '../config';
import User from '../models/user.model';
import logger from '../config/logger';

const kafka = new Kafka({
  clientId: config.SERVICE_NAME,
  brokers: [config.KAFKA_BROKER],
});

const consumer = kafka.consumer({ groupId: 'user-service-group' });

export const startConsumer = async () => {
  try {
    await consumer.connect();

    await consumer.subscribe({
      topic: 'user-registered',
      fromBeginning: process.env.NODE_ENV !== 'production',
    });

    logger.info('Kafka consumer connected and subscribed');

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (topic !== 'user-registered') return;

        const value = message.value?.toString();
        if (!value) return;

        try {
          const data = JSON.parse(value);
          if (!data.userId || !data.email) {
            logger.warn('Invalid user-registered payload', data);
            return;
          }

          logger.info(
            `Consumed ${topic}[${partition}] offset ${message.offset} for ${data.email}`
          );

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

          logger.info(`User ${data.email} synced successfully`);
        } catch (err) {
          logger.error('Error processing Kafka message', err);
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
    logger.info('Kafka consumer disconnected');
  } catch (err) {
    logger.error('Error during Kafka disconnection', err);
  }
};
