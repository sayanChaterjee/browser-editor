import fs from 'fs';
import path from 'path';
import {
  Consumer,
  EachMessagePayload,
  Kafka,
  KafkaConfig,
  Partitioners,
  Producer,
  ProducerRecord,
} from 'kafkajs';
import type { Logger } from './logger';
import { retryInBackground, RetryOptions } from './retry';

export interface KafkaClientOptions {
  clientId: string;
  broker: string;
  logger: Logger;
  // Where ca.pem / service.cert / service.key live: Render secret files in production,
  // ./certs in development. Without them the client connects in plaintext (local Kafka).
  certsDir?: string;
}

function readCert(dir: string, file: string, logger: Logger): string | null {
  const filePath = path.join(dir, file);
  try {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8').trim() : null;
  } catch (err) {
    logger.error(`[Kafka] Error reading cert file ${file}: ${(err as Error).message}`);
    return null;
  }
}

export function createKafka({ clientId, broker, logger, certsDir }: KafkaClientOptions): Kafka {
  const isProduction = process.env.NODE_ENV === 'production';
  const dir = certsDir ?? (isProduction ? '/etc/secrets' : path.join(process.cwd(), 'certs'));

  const config: KafkaConfig = {
    clientId,
    brokers: [broker],
    connectionTimeout: 10000,
    authenticationTimeout: 10000,
  };

  const ca = readCert(dir, 'ca.pem', logger);
  const key = readCert(dir, 'service.key', logger);
  const cert = readCert(dir, 'service.cert', logger);
  if (ca && key && cert) {
    config.ssl = { rejectUnauthorized: true, ca: [ca], key, cert };
  } else if (isProduction) {
    logger.error(`[Kafka] SSL certificates missing in production (${dir})`);
  }

  return new Kafka(config);
}

export interface ManagedConsumerOptions {
  name: string;
  groupId: string;
  topics: { topic: string; fromBeginning?: boolean }[];
  eachMessage: (payload: EachMessagePayload) => Promise<void>;
  logger: Logger;
  retry?: RetryOptions;
}

/**
 * A consumer that never blocks or crashes its service: it connects in the background,
 * retries with backoff, and restarts itself after crashes kafkajs won't recover from.
 * Each attempt uses a fresh kafkajs consumer, since a consumer that has run can't
 * subscribe again.
 */
export class ManagedConsumer {
  private consumer?: Consumer;
  private connected = false;
  private stopped = false;
  private cancelRetry?: () => void;

  constructor(
    private readonly kafka: Kafka,
    private readonly options: ManagedConsumerOptions,
  ) {}

  start(): void {
    const { name, logger, retry } = this.options;
    this.cancelRetry?.();
    this.cancelRetry = retryInBackground(
      () => this.connectAndRun(),
      (err, attempt, delay) =>
        logger.error(`${name} failed to start (attempt ${attempt}), retrying in ${delay}ms: ${err.message}`),
      retry,
    );
  }

  isConnected(): boolean {
    return this.connected;
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.cancelRetry?.();
    await this.consumer?.disconnect();
  }

  private async connectAndRun(): Promise<void> {
    const { name, groupId, topics, eachMessage, logger } = this.options;
    await this.consumer?.disconnect().catch(() => undefined);

    const consumer = this.kafka.consumer({ groupId });
    this.consumer = consumer;

    // Joining the group marks Kafka as up, including after kafkajs' own restarts.
    consumer.on(consumer.events.GROUP_JOIN, () => {
      this.connected = true;
    });
    consumer.on(consumer.events.DISCONNECT, () => {
      this.connected = false;
    });
    consumer.on(consumer.events.CRASH, ({ payload }) => {
      this.connected = false;
      if (!payload.restart && !this.stopped && this.consumer === consumer) {
        logger.error(`${name} crashed, restarting: ${payload.error.message}`);
        this.start();
      }
    });

    try {
      await consumer.connect();
      for (const { topic, fromBeginning = false } of topics) {
        await consumer.subscribe({ topic, fromBeginning });
      }
      await consumer.run({ eachMessage });
      logger.info(`${name} connected and subscribed to ${topics.map((t) => t.topic).join(', ')}`);
    } catch (err) {
      await consumer.disconnect().catch(() => undefined);
      throw err;
    }
  }
}

export interface ManagedProducerOptions {
  name: string;
  logger: Logger;
  retry?: RetryOptions;
}

/** A producer that connects in the background with retries and reconnects after drops. */
export class ManagedProducer {
  private readonly producer: Producer;
  private connected = false;
  private stopped = false;
  private cancelRetry?: () => void;

  constructor(
    kafka: Kafka,
    private readonly options: ManagedProducerOptions,
  ) {
    this.producer = kafka.producer({
      allowAutoTopicCreation: true,
      createPartitioner: Partitioners.DefaultPartitioner,
    });
    this.producer.on(this.producer.events.CONNECT, () => {
      this.connected = true;
    });
    this.producer.on(this.producer.events.DISCONNECT, () => {
      this.connected = false;
      if (!this.stopped) this.start();
    });
  }

  start(): void {
    const { name, logger, retry } = this.options;
    this.cancelRetry?.();
    this.cancelRetry = retryInBackground(
      async () => {
        await this.producer.connect();
        logger.info(`${name} connected`);
      },
      (err, attempt, delay) =>
        logger.error(`${name} failed to connect (attempt ${attempt}), retrying in ${delay}ms: ${err.message}`),
      retry,
    );
  }

  // An idle producer only notices an outage on its next send.
  isConnected(): boolean {
    return this.connected;
  }

  send(record: ProducerRecord) {
    return this.producer.send(record);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.cancelRetry?.();
    await this.producer.disconnect();
  }
}
