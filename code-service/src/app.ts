import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import logger from './config/logger';
import { codeRouter } from './routes/code.route';
import { contestRouter } from './routes/contest.route';
import mongoose from 'mongoose';
import { setupGracefulShutdown } from './utils/shutdown';
import { correlationMiddleware } from './middlewares/correlation.middleware';

import { internalSecurity } from './middlewares/internalSecurity.middleware';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
// CORS is handled by API Gateway, no need for it here
app.use(express.json());
app.use(correlationMiddleware);

// Public health check (liveness: the process is up)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: config.SERVICE_NAME });
});

// Readiness: MongoDB and Redis are required to serve requests; Kafka is reported
// but optional (the service retries it in the background)
app.get('/ready', (req, res) => {
  const checks = {
    mongo: mongoose.connection.readyState === 1 ? 'up' : 'down',
    redis: redis.status === 'ready' ? 'up' : 'down',
    kafka: isKafkaConnected() ? 'up' : 'down',
  };
  const ready = checks.mongo === 'up' && checks.redis === 'up';
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', service: config.SERVICE_NAME, checks });
});

app.use('/', internalSecurity, codeRouter);
app.use('/contest', internalSecurity, contestRouter);

import { startSecurityConsumer, isKafkaConnected } from './events/consumers/security.consumer';
import redis from './config/redis';

const startServer = async () => {
  try {
    await mongoose.connect(config.DATABASE_URL);
    logger.info('Connected to MongoDB');

    const { startFlusherWorker } = require('./scripts/flusher.worker');
    const { startCodeJanitor } = require('./scripts/janitor.worker');
    startFlusherWorker();
    startCodeJanitor();

    const server = app.listen(config.PORT, () => {
      logger.info(`${config.SERVICE_NAME} running on port ${config.PORT}`);
    });

    setupGracefulShutdown(server);

    // Kafka connects in the background (with retries) so it can't block or crash the API
    void startSecurityConsumer();
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
