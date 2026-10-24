import { createLogger } from '@ceditor/common';
import { config } from './index';

export default createLogger(config.SERVICE_NAME, config.LOG_LEVEL);
