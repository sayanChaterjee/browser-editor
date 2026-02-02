import { Kafka } from 'kafkajs';
import { config } from './index';
import fs from 'fs';

const kafkaConfig: any = {
  clientId: 'auth-service',
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

export const producer = kafka.producer();

export const connectKafka = async () => {
  await producer.connect();
};
