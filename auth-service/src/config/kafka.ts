import { Kafka } from 'kafkajs';
import { config } from './index';

const kafkaConfig: any = {
  clientId: 'auth-service',
  brokers: [config.KAFKA_BROKER],
};

if (config.KAFKA_CA_CERT && config.KAFKA_SERVICE_KEY && config.KAFKA_SERVICE_CERT) {
  kafkaConfig.ssl = {
    rejectUnauthorized: true,
    ca: [config.KAFKA_CA_CERT],
    key: config.KAFKA_SERVICE_KEY,
    cert: config.KAFKA_SERVICE_CERT,
  };
}

const kafka = new Kafka(kafkaConfig);

export const producer = kafka.producer();

export const connectKafka = async () => {
  await producer.connect();
};
