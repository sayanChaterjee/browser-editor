import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import logger from './config/logger';
import { userRouter } from './routes/user.route';
import mongoose from 'mongoose';
import { startConsumer } from './events/consumer';
import { setupGracefulShutdown } from './utils/shutdown';
import { correlationMiddleware } from './middlewares/correlation.middleware';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(express.json());
app.use(correlationMiddleware);

app.use('/', userRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: config.SERVICE_NAME });
});

const startServer = async () => {
  try {
    await mongoose.connect(config.DATABASE_URL);
    logger.info('Connected to MongoDB');

    await startConsumer();

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
