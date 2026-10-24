import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import {
  correlationMiddleware,
  healthRoutes,
  internalSecurity,
  isRedisReady,
  registerDependencyGauge,
  setupGracefulShutdown,
} from '@ceditor/common';
import { config } from './config';
import logger from './config/logger';
import redis from './config/redis';
import { metrics } from './config/metrics';
import { userRouter } from './routes/user.route';
import { startConsumer, isKafkaConnected, disconnectConsumer } from './events/consumer';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(metrics.httpMetrics);
app.use(express.json());
app.use(correlationMiddleware);

// /health (liveness) and /ready: MongoDB and Redis are required; Kafka is reported but
// optional (the consumer retries in the background)
const dependencies = {
  mongo: { isUp: () => mongoose.connection.readyState === 1, required: true },
  redis: { isUp: () => isRedisReady(redis), required: true },
  kafka: { isUp: isKafkaConnected, required: false },
};
app.use(healthRoutes(config.SERVICE_NAME, dependencies));

// Prometheus metrics (token-protected): HTTP timings, runtime, dependency status
registerDependencyGauge(metrics, dependencies);
app.use(metrics.metricsRoute);

// Protect all other routes
app.use('/', internalSecurity(config.INTERNAL_GATEWAY_SECRET, logger), userRouter);

const startServer = async () => {
  try {
    await mongoose.connect(config.DATABASE_URL);
    logger.info('Connected to MongoDB');

    const server = app.listen(config.PORT, () => {
      logger.info(`${config.SERVICE_NAME} running on port ${config.PORT}`);
    });

    setupGracefulShutdown(server, logger, {
      cleanup: [
        { name: 'Kafka', run: disconnectConsumer },
        { name: 'Redis', run: () => redis.quit() },
        { name: 'MongoDB', run: () => mongoose.connection.close() },
      ],
    });

    // Kafka connects in the background (with retries) so it can't block or crash the API
    startConsumer();
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
