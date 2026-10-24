import { createKafka, ManagedProducer } from '@ceditor/common';
import { config } from '.';
import logger from './logger';

const kafka = createKafka({ clientId: config.SERVICE_NAME, broker: config.KAFKA_BROKER, logger });

// Kafka isn't needed to serve HTTP: the producer connects in the background with retries.
export const producer = new ManagedProducer(kafka, { name: 'Kafka producer', logger });
