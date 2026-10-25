import { createRedis, isRedisReady } from '@ceditor/common';
import { config } from '.';
import logger from './logger';

// Fail fast while Redis is down instead of queueing commands: callers then fall back to
// MongoDB (reads and saves) rather than hanging for the client's reconnect attempts.
const redis = createRedis(config.REDIS_URL, logger, {
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

export default redis;

/** Whether Redis can take commands right now. */
export const redisUp = () => isRedisReady(redis);
