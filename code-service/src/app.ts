import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config';
import logger from './config/logger';
import { codeRouter } from './routes/code.route';
import mongoose from 'mongoose';
import { setupGracefulShutdown } from './utils/shutdown';
import { correlationMiddleware } from './middlewares/correlation.middleware';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors());
app.use(express.json());
app.use(correlationMiddleware);

app.use('/', codeRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: config.SERVICE_NAME });
});

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
