import Redis from 'ioredis';
import { config } from './index';
import logger from './logger';

if (!config.REDIS_URL) {
  throw new Error('REDIS_URL is not defined');
}

const redis = new Redis(config.REDIS_URL);

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

redis.on('error', (err) => {
  logger.error('Redis error:', err);
});

export default redis;
