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

const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 30000;
let kafkaConnected = false;
let shuttingDown = false;

export const isKafkaConnected = () => kafkaConnected;

producer.on(producer.events.DISCONNECT, () => {
  kafkaConnected = false;
});

// Kafka isn't needed to serve HTTP, so it never blocks startup: on failure, retry in
// the background with exponential backoff until it connects.
export const connectKafka = async (attempt = 1): Promise<void> => {
  try {
    await producer.connect();
    kafkaConnected = true;
    logger.info('Kafka producer connected');
  } catch (err) {
    if (shuttingDown) return;
    const delay = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS);
    logger.error(`Failed to connect Kafka producer (attempt ${attempt}), retrying in ${delay}ms: ${(err as Error).message}`);
    setTimeout(() => void connectKafka(attempt + 1), delay);
  }
};

export const disconnectKafka = async () => {
  shuttingDown = true;
  try {
    await producer.disconnect();
    logger.info('Kafka producer disconnected');
  } catch (err) {
    logger.error('Error disconnecting Kafka producer:', err);
  }
};
