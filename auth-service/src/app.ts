import dotenv from 'dotenv';
dotenv.config();
import cookieParser from 'cookie-parser';

import express from 'express';
import helmet from 'helmet';

import { verifyToken } from './middlewares/auth.middleware';
import { errorHandler } from './middlewares/error.middleware';
import { corsMiddleware } from './middlewares/cors.middleware';
import logger from './config/logger';
import { reqLogger } from './middlewares/req.middleware';
import { config } from './config';
import { authRouter, indexRouter } from './routes';
import init from './init';
import { setupGracefulShutdown } from './utils/shutdown';
import { connectDB } from './db/db';

const app = express();

app.use(helmet());
app.use(corsMiddleware);

app.use(cookieParser());
app.use(reqLogger);
app.use(express.json());

// app.use(verifyToken);

app.use('/api/v1/auth', authRouter);
app.use('/', indexRouter);


app.use(errorHandler);

(async () => {
  try {
    await connectDB();
    await init();

    const server = app.listen(config.PORT, () => {
      logger.info(
        `${config.SERVICE_NAME} is running on http://localhost:${config.PORT}`,
      );
    });

    setupGracefulShutdown(server);
  } catch (err) {
    logger.error('error during application initialization', err);
  }
})();
