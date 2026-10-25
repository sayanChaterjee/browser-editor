import { createLogger } from '@ceditor/common';
import { config } from '.';

export default createLogger(config.SERVICE_NAME, config.LOG_LEVEL);
