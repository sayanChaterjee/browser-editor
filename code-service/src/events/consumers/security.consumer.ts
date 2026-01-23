import { Kafka } from 'kafkajs';
import { config } from '../../config';
import redis from '../../config/redis';
import logger from '../../config/logger';

const kafka = new Kafka({
    clientId: `${config.SERVICE_NAME}-security-consumer`,
    brokers: [config.KAFKA_BROKER || 'localhost:9092'],
});

const consumer = kafka.consumer({ groupId: 'code-service-security-group' });

export const startSecurityConsumer = async () => {
    try {
        await consumer.connect();
        await consumer.subscribe({ topic: 'user-security-updates', fromBeginning: false });

        logger.info('Kafka security consumer connected and subscribed to user-security-updates');

        await consumer.run({
            eachMessage: async ({ topic, message }) => {
                const value = message.value?.toString();
                if (!value) return;

                try {
                    const { userId, event } = JSON.parse(value);

                    if (event === 'PASSWORD_CHANGED' || event === 'LOGOUT_ALL') {
                        logger.info(`Security event [${event}] received for user: ${userId}. Purging cache.`);

                        // Purge project list cache
                        const listCacheKey = `user:projects:${userId}`;
                        await redis.del(listCacheKey);

                        // In an ideal world, we'd also purge specific project caches if we had the IDs,
                        // or use a versioning/tagging system for cache invalidation.
                        // For now, purging the list is a good first step.

                        logger.info(`Cache purged for user: ${userId}`);
                    }
                } catch (err) {
                    logger.error('Error processing security event message', err);
                }
            },
        });
    } catch (err) {
        logger.error('Security consumer failed to start', err);
    }
};

export const disconnectSecurityConsumer = async () => {
    try {
        await consumer.disconnect();
        logger.info('Security consumer disconnected');
    } catch (err) {
        logger.error('Error disconnecting security consumer', err);
    }
};
