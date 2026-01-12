import winston from 'winston';
import { config } from '.';

const logger = winston.createLogger({
  level: config.LOG_LEVEL || 'info',
  defaultMeta: { service: config.SERVICE_NAME },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, service, stack }) => {
          return `${timestamp} [${level}] [${service}]: ${stack || message}`;
        })
      )
    })
  ],
});

export default logger;