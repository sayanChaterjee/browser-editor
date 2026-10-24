import { Router } from 'express';
import mongoose from 'mongoose';
import { healthRoutes, registerDependencyGauge } from '@ceditor/common';
import { config } from '../config';
import { producer } from '../config/kafka';
import { metrics } from '../config/metrics';

const indexRouter = Router();

indexRouter.get('/', async (req, res): Promise<any> => {
  return res.json({ service: config.SERVICE_NAME, status: 'running' });
});

// /health (liveness) and /ready: MongoDB is required; Kafka is reported but optional
// (the producer retries in the background)
const dependencies = {
  mongo: { isUp: () => mongoose.connection.readyState === 1, required: true },
  kafka: { isUp: () => producer.isConnected(), required: false },
};
indexRouter.use(healthRoutes(config.SERVICE_NAME, dependencies));

// Prometheus metrics (token-protected): HTTP timings, runtime, dependency status
registerDependencyGauge(metrics, dependencies);
indexRouter.use(metrics.metricsRoute);

export { indexRouter };
