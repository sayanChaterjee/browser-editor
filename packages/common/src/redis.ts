import Redis, { RedisOptions } from 'ioredis';
import type { Logger } from './logger';

export type { Redis };

export function createRedis(url: string, logger: Logger, options: RedisOptions = {}): Redis {
  const redis = new Redis(url, options);

  redis.on('connect', () => logger.info('Connected to Redis'));
  redis.on('error', (err) => logger.error(`Redis error: ${err.message}`));
  redis.on('close', () => logger.warn('Redis connection closed'));

  return redis;
}

export const isRedisReady = (redis: Redis) => redis.status === 'ready';
