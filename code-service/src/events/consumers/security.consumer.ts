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

const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 30000;
let kafkaConnected = false;
let shuttingDown = false;

export const isKafkaConnected = () => kafkaConnected;

// A crash kafkajs won't recover from on its own goes back through the retry loop.
consumer.on(consumer.events.CRASH, ({ payload }) => {
    kafkaConnected = false;
    if (!payload.restart && !shuttingDown) {
        logger.error(`Security consumer crashed, restarting: ${payload.error.message}`);
        void startSecurityConsumer();
    }
});
// Joining the consumer group marks Kafka as up, including after kafkajs' own restarts.
consumer.on(consumer.events.GROUP_JOIN, () => {
    kafkaConnected = true;
});
consumer.on(consumer.events.DISCONNECT, () => {
    kafkaConnected = false;
});

// Kafka isn't needed to serve HTTP, so it never blocks startup: on failure, retry in
// the background with exponential backoff until it connects.
export const startSecurityConsumer = async (attempt = 1): Promise<void> => {
    try {
        await connectAndRun();
    } catch (err) {
        if (shuttingDown) return;
        const delay = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS);
        logger.error(`Security consumer failed to start (attempt ${attempt}), retrying in ${delay}ms: ${(err as Error).message}`);
        await consumer.disconnect().catch(() => undefined);
        setTimeout(() => void startSecurityConsumer(attempt + 1), delay);
    }
};

const connectAndRun = async () => {
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
};

export const disconnectSecurityConsumer = async () => {
    shuttingDown = true;
    try {
        await consumer.disconnect();
        logger.info('Security consumer disconnected');
    } catch (err) {
        logger.error('Error disconnecting security consumer', err);
    }
};
