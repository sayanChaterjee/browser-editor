interface Config {
  SERVICE_NAME: string;
  PORT: number;
  DEFAULT_TIMEOUT: number;
  LOG_LEVEL: string;
  REDIS_URL: string;
  AUTH_SERVICE_URL: string;
  USER_SERVICE_URL: string;
  CODE_SERVICE_URL: string;
  ALLOWED_ORIGINS: string;
}

import { normalizeServiceUrl } from '../utils/urlHelper';

export const config: Config = {
  SERVICE_NAME: require('../../package.json').name,
  PORT: Number(process.env.PORT) || 3000,
  DEFAULT_TIMEOUT: Number(process.env.DEFAULT_TIMEOUT || '30000'),
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:3001,http://localhost:3005,http://localhost:3000,http://localhost:3004,http://localhost:3006',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  AUTH_SERVICE_URL: normalizeServiceUrl(process.env.AUTH_SERVICE_URL || 'http://localhost:3001'),
  USER_SERVICE_URL: normalizeServiceUrl(process.env.USER_SERVICE_URL || 'http://localhost:3002'),
  CODE_SERVICE_URL: normalizeServiceUrl(process.env.CODE_SERVICE_URL || 'http://localhost:3003'),
};