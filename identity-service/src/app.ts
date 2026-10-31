import dotenv from 'dotenv';
dotenv.config();
import cookieParser from 'cookie-parser';

import express from 'express';
import helmet from 'helmet';

import { errorHandler } from './middlewares/error.middleware';
import { corsMiddleware } from './middlewares/cors.middleware';
import logger from './config/logger';
import { reqLogger } from './middlewares/req.middleware';
import { config } from './config';
import { indexRouter } from './routes';
import { userRouter } from './routes/user.route';
import redis from './config/redis';
import { correlationMiddleware, ensureOutboxIndexes, internalSecurity, setupGracefulShutdown } from '@ceditor/common';
import mongoose from 'mongoose';
import { outboxRelay } from './events/publisher';
import { connectDB, disconnectDB } from './db/db';
import { producer } from './config/kafka';
import { metrics } from './config/metrics';
import { getAuth } from './lib/auth';
import { toNodeHandler } from 'better-auth/node';
import { syncOwnerRoles } from './lib/roles';

const app = express();

app.set("trust proxy", true);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(metrics.httpMetrics);
app.use(cookieParser());
app.use(correlationMiddleware);
app.use(reqLogger);
app.use(express.json());

// Mount better-auth handler at /api/auth (will be initialized after DB connection)
app.use('/api/auth', corsMiddleware, (req, res) => {
  try {
    const auth = getAuth();
    const handler = toNodeHandler(auth);
    return handler(req, res);
  } catch (error: any) {
    logger.error('Auth handler error:', error);
    res.status(500).json({ error: 'Authentication service unavailable' });
  }
});

// User profiles and admin moderation, reached only through the gateway (/api/v1/user/*)
app.use('/users', internalSecurity(config.INTERNAL_GATEWAY_SECRET, logger), userRouter);

// Health checks and metrics
app.use('/', indexRouter);


app.use(errorHandler);

(async () => {
  try {
    await connectDB();
    // Events are saved in the outbox with each change; the relay sends them to Kafka
    await ensureOutboxIndexes(mongoose.connection.db!);
    outboxRelay.start();
    // Kafka connects in the background (with retries) so it can't block or crash the API
    producer.start();

    // Initialize auth after DB connection
    logger.info('Initializing better-auth...');
    getAuth();
    logger.info('Better-auth initialized successfully');
    // Owners already registered get the admin role (not fatal: they keep their current one)
    await syncOwnerRoles().catch((err) => logger.error(`Owner role sync failed: ${err.message}`));

    const server = app.listen(config.PORT, '0.0.0.0', () => {
      logger.info(
        `${config.SERVICE_NAME} is running on http://0.0.0.0:${config.PORT}`,
      );
    });

    setupGracefulShutdown(server, logger, {
      cleanup: [
        { name: 'Outbox relay', run: () => outboxRelay.stop() },
        { name: 'Kafka', run: () => producer.stop() },
        { name: 'Redis', run: () => redis.quit() },
        { name: 'MongoDB', run: disconnectDB },
      ],
    });
  } catch (err) {
    logger.error('error during application initialization', err);
    process.exit(1);
  }
})();
