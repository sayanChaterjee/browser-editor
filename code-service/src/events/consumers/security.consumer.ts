import { EachMessagePayload } from 'kafkajs';
import { createKafka, ManagedConsumer } from '@ceditor/common';
import { config } from '../../config';
import redis from '../../config/redis';
import logger from '../../config/logger';

const kafka = createKafka({ clientId: config.SERVICE_NAME, broker: config.KAFKA_BROKER, logger });

const handleMessage = async ({ message }: EachMessagePayload) => {
    const value = message.value?.toString();
    if (!value) return;

    try {
        const { userId, event } = JSON.parse(value);

        if (event === 'PASSWORD_CHANGED' || event === 'LOGOUT_ALL') {
            logger.info(`Security event [${event}] received for user: ${userId}. Purging cache.`);

            // Purge project list cache
            const listCacheKey = `user:projects:${userId}`;
            await redis.del(listCacheKey);

            logger.info(`Cache purged for user: ${userId}`);
        }
    } catch (err) {
        logger.error('Error processing security event message', err);
    }
};

const consumer = new ManagedConsumer(kafka, {
    name: 'Security consumer',
    groupId: 'code-service-security-group',
    topics: [{ topic: 'user-security-updates', fromBeginning: false }],
    eachMessage: handleMessage,
    logger,
});

// Kafka isn't needed to serve HTTP: the consumer connects in the background with retries.
export const startSecurityConsumer = () => consumer.start();
export const isKafkaConnected = () => consumer.isConnected();
export const disconnectSecurityConsumer = () => consumer.stop();
