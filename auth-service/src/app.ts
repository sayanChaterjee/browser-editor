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
import init from './init';
import { setupGracefulShutdown } from './utils/shutdown';
import { connectDB } from './db/db';
import { connectKafka } from './config/kafka';
import { correlationMiddleware } from './middlewares/correlation.middleware';
import { getAuth } from './lib/auth';
import { toNodeHandler } from 'better-auth/node';
import { webhookRouter } from './routes/webhook.route';
import { internalSecurity } from './middlewares/internalSecurity.middleware';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(corsMiddleware);

app.use(cookieParser());
app.use(correlationMiddleware);
app.use(reqLogger);
app.use(express.json());

// Mount better-auth handler at /api/auth (will be initialized after DB connection)
app.use('/api/auth', (req, res, next) => {
  try {
    const auth = getAuth();
    const handler = toNodeHandler(auth);
    return handler(req, res);
  } catch (error: any) {
    logger.error('Auth handler error:', error);
    res.status(500).json({ error: 'Authentication service unavailable' });
  }
});

// Apply internal security to all remaining /api routes (webhooks, etc.)
app.use('/api', internalSecurity, webhookRouter);

// Keep the index router for health checks
app.use('/', indexRouter);


app.use(errorHandler);

(async () => {
  try {
    await connectDB();
    await connectKafka();
    await init();

    // Initialize auth after DB connection
    logger.info('Initializing better-auth...');
    getAuth();
    logger.info('Better-auth initialized successfully');

    const { startAuthJanitor } = require('./scripts/janitor');
    startAuthJanitor();

    const server = app.listen(config.PORT, '0.0.0.0', () => {
      logger.info(
        `${config.SERVICE_NAME} is running on http://0.0.0.0:${config.PORT}`,
      );
    });

    setupGracefulShutdown(server);
  } catch (err) {
    logger.error('error during application initialization', err);
  }
})();
