import { Router } from 'express';
import mongoose from 'mongoose';
import { healthRoutes } from '@ceditor/common';
import { config } from '../config';
import { producer } from '../config/kafka';

const indexRouter = Router();

indexRouter.get('/', async (req, res): Promise<any> => {
  return res.json({ service: config.SERVICE_NAME, status: 'running' });
});

// /health (liveness) and /ready: MongoDB is required; Kafka is reported but optional
// (the producer retries in the background)
indexRouter.use(healthRoutes(config.SERVICE_NAME, {
  mongo: { isUp: () => mongoose.connection.readyState === 1, required: true },
  kafka: { isUp: () => producer.isConnected(), required: false },
}));

export { indexRouter };
