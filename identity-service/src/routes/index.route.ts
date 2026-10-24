import { Router } from 'express';
import mongoose from 'mongoose';
import { healthRoutes, isRedisReady, registerDependencyGauge } from '@ceditor/common';
import { config } from '../config';
import { producer } from '../config/kafka';
import redis from '../config/redis';
import { metrics } from '../config/metrics';

const indexRouter = Router();

indexRouter.get('/', async (req, res): Promise<any> => {
  return res.json({ service: config.SERVICE_NAME, status: 'running' });
});

// /health (liveness) and /ready: MongoDB is required; Redis (session-cache revocation)
// and Kafka (the producer retries in the background) are reported but optional
const dependencies = {
  mongo: { isUp: () => mongoose.connection.readyState === 1, required: true },
  redis: { isUp: () => isRedisReady(redis), required: false },
  kafka: { isUp: () => producer.isConnected(), required: false },
};
indexRouter.use(healthRoutes(config.SERVICE_NAME, dependencies));

// Prometheus metrics (token-protected): HTTP timings, runtime, dependency status
registerDependencyGauge(metrics, dependencies);
indexRouter.use(metrics.metricsRoute);

export { indexRouter };
