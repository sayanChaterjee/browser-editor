import Redis from 'ioredis';
import { config } from './index';
import logger from './logger';

let redis: Redis | null = null;

if (config.REDIS_URL) {
  redis = new Redis(config.REDIS_URL);

  redis.on('connect', () => {
    logger.info('Connected to Redis');
  });

  redis.on('error', (err) => {
    logger.error('Redis error:', err);
  });
}

export default redis;
