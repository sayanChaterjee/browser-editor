import { Kafka } from 'kafkajs';
import { config } from './index';

const kafka = new Kafka({
  clientId: 'auth-service',
  brokers: [config.KAFKA_BROKER],
});

export const producer = kafka.producer();

export const connectKafka = async () => {
  await producer.connect();
};
