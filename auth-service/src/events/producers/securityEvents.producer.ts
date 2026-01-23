import { Kafka } from 'kafkajs';
import { config } from '../../config';
import logger from '../../config/logger';

const kafka = new Kafka({
    clientId: `${config.SERVICE_NAME}-security-producer`,
    brokers: [config.KAFKA_BROKER],
});

const producer = kafka.producer();

export const publishSecurityEvent = async ({ userId, event }: { userId: string, event: 'PASSWORD_CHANGED' | 'LOGOUT_ALL' }) => {
    try {
        await producer.connect();
        await producer.send({
            topic: 'user-security-updates',
            messages: [
                {
                    key: userId,
                    value: JSON.stringify({ userId, event, timestamp: new Date().toISOString() }),
                },
            ],
        });
        logger.info(`Security event [${event}] published for user: ${userId}`);
    } catch (err) {
        logger.error('Failed to publish security event', err);
    } finally {
        await producer.disconnect();
    }
};
