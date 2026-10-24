import { Kafka, Producer } from 'kafkajs';
import { config } from '../config';
import User from '../models/user.model';
import logger from '../config/logger';
import fs from 'fs';
import path from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const certsDir = isProduction ? '/etc/secrets' : path.join(process.cwd(), 'certs');

const loadCert = (filename: string) => {
  const filePath = path.join(certsDir, filename);
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return content.trim();
    }
  } catch (err) {
    logger.error(`[Kafka Consumer] Error reading cert file ${filename}:`, err);
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
  logger.error('[Kafka Consumer] Critical SSL certificates missing in production environment (/etc/secrets)!');
}

const kafka = new Kafka(kafkaConfig);

const consumer = kafka.consumer({ groupId: 'user-service-group' });
let dlqProducer: Producer;

const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 30000;
let kafkaConnected = false;
let shuttingDown = false;

export const isKafkaConnected = () => kafkaConnected;

// A crash kafkajs won't recover from on its own goes back through the retry loop.
consumer.on(consumer.events.CRASH, ({ payload }) => {
  kafkaConnected = false;
  if (!payload.restart && !shuttingDown) {
    logger.error(`Kafka consumer crashed, restarting: ${payload.error.message}`);
    void startConsumer();
  }
});
// Joining the consumer group marks Kafka as up, including after kafkajs' own restarts.
consumer.on(consumer.events.GROUP_JOIN, () => {
  kafkaConnected = true;
});
consumer.on(consumer.events.DISCONNECT, () => {
  kafkaConnected = false;
});

// Kafka isn't needed to serve HTTP, so it never blocks startup: on failure, retry in
// the background with exponential backoff until it connects.
export const startConsumer = async (attempt = 1): Promise<void> => {
  try {
    await connectAndRun();
  } catch (err) {
    if (shuttingDown) return;
    const delay = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS);
    logger.error(`Kafka consumer failed to start (attempt ${attempt}), retrying in ${delay}ms: ${(err as Error).message}`);
    await consumer.disconnect().catch(() => undefined);
    await dlqProducer?.disconnect().catch(() => undefined);
    setTimeout(() => void startConsumer(attempt + 1), delay);
  }
};

const connectAndRun = async () => {
  dlqProducer = kafka.producer();
  await dlqProducer.connect();
  await consumer.connect();

  await consumer.subscribe({
    topic: 'user-registered',
    fromBeginning: process.env.NODE_ENV !== 'production',
  });

  logger.info('Kafka consumer connected and subscribed (with Retries & DLQ)');

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      if (topic !== 'user-registered') return;

      const value = message.value?.toString();
      if (!value) return;

      let data;
      try {
        data = JSON.parse(value);
      } catch (err) {
        logger.error('Failed to parse Kafka message', err);
        return;
      }

      // Processing with Retry Strategy
      const MAX_RETRIES = 5;
      let attempt = 0;
      let success = false;
      let lastError: any = null;

      while (attempt < MAX_RETRIES && !success) {
        try {
          attempt++;
          if (!data.userId) {
            throw new Error('Invalid user-registered payload: missing userId');
          }

          logger.info(`[${topic}] Processing sync attempt ${attempt}/${MAX_RETRIES} for ${data.userId}`);

          await User.findOneAndUpdate(
            { _id: data.userId },
            {
              $set: {
                name: data.name,
              },
            },
            { upsert: true, new: true, runValidators: true }
          );

          logger.info(`[${topic}] User ${data.userId} synced successfully on attempt ${attempt}`);
          success = true;
        } catch (err: any) {
          lastError = err;
          logger.error(`[${topic}] Sync attempt ${attempt} failed: ${err.message}`);

          if (attempt < MAX_RETRIES) {
            const jitter = Math.random() * 1000;
            const delay = Math.pow(2, attempt) * 1000 + jitter;
            logger.info(`[${topic}] Retrying in ${Math.round(delay)}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      if (!success) {
        logger.error(`[${topic}] Message failed after ${MAX_RETRIES} attempts. Sending to DLQ. Reason: ${lastError?.message || 'Unknown'}`);
        await dlqProducer.send({
          topic: 'user-registered-dlq',
          messages: [
            {
              key: message.key,
              value: JSON.stringify({
                originalPayload: data,
                error: lastError?.message || 'Failed after max retries',
                failedAt: new Date().toISOString(),
                retryAttempts: MAX_RETRIES
              })
            }
          ]
        });
      }
    },
  });
};

export const disconnectConsumer = async () => {
  shuttingDown = true;
  try {
    logger.info('Disconnecting Kafka consumer...');
    await consumer.disconnect();
    if (dlqProducer) await dlqProducer.disconnect();
    logger.info('Kafka consumer and DLQ producer disconnected');
  } catch (err) {
    logger.error('Error during Kafka disconnection', err);
  }
};
