import { Kafka, Partitioners } from 'kafkajs';
import fs from 'fs';
import path from 'path';
import { config } from './index';
import logger from './logger';

const isProduction = process.env.NODE_ENV === 'production';
const certsDir = isProduction ? '/etc/secrets' : path.join(process.cwd(), 'certs');

const loadCert = (filename: string) => {
  const filePath = path.join(certsDir, filename);
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Render/User tip: Ensure no quotes or extra characters
      return content.trim();
    }
  } catch (err) {
    logger.error(`[Kafka] Error reading cert file ${filename}:`, err);
  }
  return null;
};

const ca = loadCert('ca.pem');
const key = loadCert('service.key');
const cert = loadCert('service.cert');

const kafkaConfig: any = {
  clientId: config.SERVICE_NAME,
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
  logger.error('[Kafka] Critical SSL certificates missing in production environment (/etc/secrets)!');
}

export const kafka = new Kafka(kafkaConfig);

export const producer = kafka.producer({
  allowAutoTopicCreation: true,
  createPartitioner: Partitioners.DefaultPartitioner,
});

export const connectKafka = async () => {
  try {
    await producer.connect();
    logger.info('Kafka producer connected');
  } catch (err) {
    logger.error('Failed to connect Kafka producer:', err);
    if (isProduction) throw err; // Fail fast in production
  }
};

export const disconnectKafka = async () => {
  try {
    await producer.disconnect();
    logger.info('Kafka producer disconnected');
  } catch (err) {
    logger.error('Error disconnecting Kafka producer:', err);
  }
};
