import winston from 'winston'; // for logging
import { config } from '../config/index';
import { correlationContext } from '../utils/context';

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
          const correlationId = correlationContext.getStore();
          const cidStr = correlationId ? ` [CID: ${correlationId}]` : '';
          return `${timestamp}${cidStr} [${level}] [${service}]: ${stack || message}`;
        })
      )
    })
  ],
});

export default logger;