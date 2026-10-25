import { createKafka, ManagedProducer } from '@ceditor/common';
import { config } from '.';
import logger from './logger';

export const kafka = createKafka({ clientId: config.SERVICE_NAME, broker: config.KAFKA_BROKER, logger });

// One producer for contest events and for dead-lettering consumed messages. Kafka isn't
// needed to serve HTTP: it connects in the background with retries.
export const producer = new ManagedProducer(kafka, { name: 'Kafka producer', logger });
