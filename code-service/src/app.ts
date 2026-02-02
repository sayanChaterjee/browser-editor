import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import logger from './config/logger';
import { codeRouter } from './routes/code.route';
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

// Public health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: config.SERVICE_NAME });
});

app.use('/', internalSecurity, codeRouter);

import { startSecurityConsumer } from './events/consumers/security.consumer';

const startServer = async () => {
  try {
    await mongoose.connect(config.DATABASE_URL);
    logger.info('Connected to MongoDB');

    await startSecurityConsumer();

    const { startFlusherWorker } = require('./scripts/flusher.worker');
    const { startCodeJanitor } = require('./scripts/janitor.worker');
    startFlusherWorker();
    startCodeJanitor();

    const server = app.listen(config.PORT, () => {
      logger.info(`${config.SERVICE_NAME} running on port ${config.PORT}`);
    });

    setupGracefulShutdown(server);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
