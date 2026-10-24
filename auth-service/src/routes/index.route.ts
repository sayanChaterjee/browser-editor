import { Router } from 'express';
import mongoose from 'mongoose';
import { config } from '../config';
import redis from '../config/redis';
import { isKafkaConnected } from '../config/kafka';

const indexRouter = Router();

indexRouter.get('/', async (req, res): Promise<any> => {
  return res.json({ service: config.SERVICE_NAME, status: 'running' });
});

// Liveness: the process is up
indexRouter.get('/health', async (req, res): Promise<any> => {
  return res.json({ service: config.SERVICE_NAME, status: 'ok' });
});

// Readiness: MongoDB and Redis are required to serve requests; Kafka is reported
// but optional (the producer retries it in the background)
indexRouter.get('/ready', async (req, res): Promise<any> => {
  const checks = {
    mongo: mongoose.connection.readyState === 1 ? 'up' : 'down',
    redis: redis.status === 'ready' ? 'up' : 'down',
    kafka: isKafkaConnected() ? 'up' : 'down',
  };
  const ready = checks.mongo === 'up' && checks.redis === 'up';
  return res
    .status(ready ? 200 : 503)
    .json({ service: config.SERVICE_NAME, status: ready ? 'ready' : 'not_ready', checks });
});

export { indexRouter };