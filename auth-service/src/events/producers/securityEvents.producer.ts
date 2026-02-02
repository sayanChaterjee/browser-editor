import { Kafka } from 'kafkajs';
import { config } from '../../config';
import logger from '../../config/logger';
import fs from 'fs';

const kafkaConfig: any = {
    clientId: `${config.SERVICE_NAME}-security-producer`,
    brokers: [config.KAFKA_BROKER],
};

const getCert = (content: string, path: string) => {
    if (content) return content;
    if (path && fs.existsSync(path)) return fs.readFileSync(path, 'utf-8');
    return null;
};

const ca = getCert(config.KAFKA_CA_CERT, config.KAFKA_CA_CERT_PATH);
const key = getCert(config.KAFKA_SERVICE_KEY, config.KAFKA_SERVICE_KEY_PATH);
const cert = getCert(config.KAFKA_SERVICE_CERT, config.KAFKA_SERVICE_CERT_PATH);

if (ca && key && cert) {
    kafkaConfig.ssl = {
        rejectUnauthorized: true,
        ca: [ca],
        key: key,
        cert: cert,
    };
}

const kafka = new Kafka(kafkaConfig);

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
