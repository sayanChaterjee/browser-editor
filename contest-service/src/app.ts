import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import {
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

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
// CORS is handled by API Gateway, no need for it here
app.use(metrics.httpMetrics);
app.use(express.json());
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

    const server = app.listen(config.PORT, () => {
      logger.info(`${config.SERVICE_NAME} running on port ${config.PORT}`);
    });

    setupGracefulShutdown(server, logger, {
      cleanup: [
        // Leave the Kafka consumer group cleanly
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
