import { createRedis } from '@ceditor/common';
import { config } from '.';
import logger from './logger';

// Only used to revoke the gateway's cached sessions. Fail fast while Redis is down: the
// gateway can't read the cache then either, so revocation in MongoDB alone is enough.
export default createRedis(config.REDIS_URL, logger, {
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 5,
  enableOfflineQueue: false,
});
