import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import {
  ensureOutboxIndexes,
  correlationMiddleware,
  healthRoutes,
  internalSecurity,
  registerDependencyGauge,
  setupGracefulShutdown,
} from '@ceditor/common';
import { config } from './config';
import logger from './config/logger';
import { metrics } from './config/metrics';
import { attemptRouter } from './routes/attempt.route';
import { contestRouter } from './routes/contest.route';
import { isKafkaConnected, startKafka, stopKafka } from './events/userEvents.consumer';
import { outboxRelay } from './events/publisher';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
// CORS is handled by API Gateway, no need for it here
app.use(metrics.httpMetrics);
// Heartbeats can carry a snapshot of the contestant's code (three files of up to 500 KB)
app.use(express.json({ limit: '2mb' }));
app.use(correlationMiddleware);

// /health (liveness) and /ready: MongoDB is required; Kafka is reported but optional
// (events are retried in the background)
const dependencies = {
  mongo: { isUp: () => mongoose.connection.readyState === 1, required: true },
  kafka: { isUp: isKafkaConnected, required: false },
};
app.use(healthRoutes(config.SERVICE_NAME, dependencies));

// Prometheus metrics (token-protected): HTTP timings, runtime, dependency status
registerDependencyGauge(metrics, dependencies);
app.use(metrics.metricsRoute);

// Everything is reached through the gateway's /api/v1/contest/* (and the old code paths it maps here)
const requireGateway = internalSecurity(config.INTERNAL_GATEWAY_SECRET, logger);
app.use('/contest', requireGateway, attemptRouter, contestRouter);

const startServer = async () => {
  try {
    await mongoose.connect(config.DATABASE_URL);
    logger.info('Connected to MongoDB');
    // Events are saved in the outbox with each change; the relay sends them to Kafka
    await ensureOutboxIndexes(mongoose.connection.db!);
    outboxRelay.start();

    const server = app.listen(config.PORT, () => {
      logger.info(`${config.SERVICE_NAME} running on port ${config.PORT}`);
    });

    setupGracefulShutdown(server, logger, {
      cleanup: [
        // Finish the send in progress, then leave the Kafka consumer group cleanly
        { name: 'Outbox relay', run: () => outboxRelay.stop() },
        { name: 'Kafka', run: stopKafka },
        { name: 'MongoDB', run: () => mongoose.connection.close() },
      ],
    });

    // Kafka connects in the background (with retries) so it can't block or crash the API
    startKafka();
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
