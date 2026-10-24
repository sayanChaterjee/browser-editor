import { createRedis } from '@ceditor/common';
import { config } from '.';
import logger from './logger';

export default createRedis(config.REDIS_URL, logger);
