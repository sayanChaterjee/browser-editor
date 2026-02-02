import { Kafka } from 'kafkajs';
import { config } from '../../config';
import logger from '../../config/logger';
import fs from 'fs';
import path from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const certsDir = isProduction ? '/etc/secrets' : path.join(process.cwd(), 'certs');

const loadCert = (filename: string) => {
    const filePath = path.join(certsDir, filename);
    try {
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf-8');
        }
    } catch (err) {
        logger.error(`[Kafka Security] Error reading cert file ${filename}:`, err);
    }
    return null;
};

const ca = loadCert('ca.pem');
const key = loadCert('service.key');
const cert = loadCert('service.cert');

const kafkaConfig: any = {
    clientId: `${config.SERVICE_NAME}-security-producer`,
    brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
};

if (ca && key && cert) {
    kafkaConfig.ssl = {
        rejectUnauthorized: true,
        ca: [ca],
        key: key,
        cert: cert,
    };
} else if (isProduction) {
    logger.error('[Kafka Security] Critical SSL certificates missing in production environment!');
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
