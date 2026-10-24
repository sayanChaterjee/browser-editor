import winston from 'winston';
import { getCorrelationId } from './context';

export type Logger = winston.Logger;

export function createLogger(service: string, level = 'info'): Logger {
  return winston.createLogger({
    level,
    defaultMeta: { service },
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, service, stack }) => {
            const correlationId = getCorrelationId();
            const cidStr = correlationId ? ` [CID: ${correlationId}]` : '';
            return `${timestamp}${cidStr} [${level}] [${service}]: ${stack || message}`;
          }),
        ),
      }),
    ],
  });
}
