import winston from 'winston'; // for logging
import { config } from '../config/index';

const logger = winston.createLogger({
  level: config.LOG_LEVEL, // 'info', 'debug', 'error' etc.
  defaultMeta: { service: config.SERVICE_NAME },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, service }) => {
      return `[${timestamp}] [${level}] [${service}]: ${message}`;
    }),
  ),
  transports: [new winston.transports.Console()], // where the logs will be sent (console)
});

export default logger;