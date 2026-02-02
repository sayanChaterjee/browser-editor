import { Kafka } from 'kafkajs';
import { config } from '../../config';
import redis from '../../config/redis';
import logger from '../../config/logger';
import fs from 'fs';
import path from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const certsDir = isProduction ? '/etc/secrets' : path.join(process.cwd(), 'certs');

const loadCert = (filename: string) => {
    const filePath = path.join(certsDir, filename);
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            return content.trim();
        }
    } catch (err) {
        logger.error(`[Kafka Security Consumer] Error reading cert file ${filename}:`, err);
    }
    return null;
};

const ca = loadCert('ca.pem');
const key = loadCert('service.key');
const cert = loadCert('service.cert');

const kafkaConfig: any = {
    clientId: `${config.SERVICE_NAME}-security-consumer`,
    brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
    connectionTimeout: 10000,
    authenticationTimeout: 10000,
};

if (ca && key && cert) {
    kafkaConfig.ssl = {
        rejectUnauthorized: true,
        ca: [ca], // Must be an array
        key: key,
        cert: cert,
    };
} else if (isProduction) {
    logger.error('[Kafka Security Consumer] Critical SSL certificates missing in production environment (/etc/secrets)!');
}

const kafka = new Kafka(kafkaConfig);

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
