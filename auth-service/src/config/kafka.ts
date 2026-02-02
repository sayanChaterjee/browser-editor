import { Kafka } from 'kafkajs';
import fs from 'fs';
import path from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const certsDir = isProduction ? '/etc/secrets' : path.join(process.cwd(), 'certs');

const kafkaConfig: any = {
  clientId: 'auth-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
};

const loadCert = (filename: string) => {
  const filePath = path.join(certsDir, filename);
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch (err) {
    console.error(`[Kafka] Error reading cert file ${filename}:`, err);
  }
  return null;
};

const ca = loadCert('ca.pem');
const key = loadCert('service.key');
const cert = loadCert('service.cert');

if (ca && key && cert) {
  kafkaConfig.ssl = {
    rejectUnauthorized: true,
    ca: [ca],
    key: key,
    cert: cert,
  };
} else if (isProduction) {
  console.error('[Kafka] Critical SSL certificates missing in production environment!');
}

const kafka = new Kafka(kafkaConfig);

export const producer = kafka.producer();

export const connectKafka = async () => {
  try {
    await producer.connect();
  } catch (err) {
    console.error('[Kafka] Failed to connect producer:', err);
  }
};
