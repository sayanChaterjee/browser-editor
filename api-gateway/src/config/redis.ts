import { createRedis } from '@ceditor/common';
import { config } from '.';
import logger from './logger';

// Fail fast while Redis is down instead of queueing commands: rate limiting then fails
// open (passOnStoreError) rather than holding requests.
export default createRedis(config.REDIS_URL, logger, {
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 5,
  enableOfflineQueue: false,
});
