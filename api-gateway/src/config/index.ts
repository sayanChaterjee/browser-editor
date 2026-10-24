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
  INTERNAL_GATEWAY_SECRET: string;
  TRUST_PROXY_HOPS: number;
  BFF_SHARED_SECRET: string;
  TRUST_CF_CONNECTING_IP: boolean;
  RATE_LIMIT_IP_PER_MINUTE: number;
  RATE_LIMIT_AUTH_PER_15_MINUTES: number;
  RATE_LIMIT_USER_PER_MINUTE: number;
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
  INTERNAL_GATEWAY_SECRET: process.env.INTERNAL_GATEWAY_SECRET || '',
  // Number of reverse proxies in front of the gateway whose X-Forwarded-For can be trusted
  // (0 = header ignored). Only affects req.ip; rate limiting uses clientIpMiddleware.
  TRUST_PROXY_HOPS: Number(process.env.TRUST_PROXY_HOPS || '0'),
  // Shared with the frontend's /api proxy, which uses it to vouch for the client IP it forwards.
  BFF_SHARED_SECRET: process.env.BFF_SHARED_SECRET || '',
  // Only true where the gateway sits behind Cloudflare (Render), which overwrites this header.
  TRUST_CF_CONNECTING_IP: process.env.TRUST_CF_CONNECTING_IP === 'true',
  RATE_LIMIT_IP_PER_MINUTE: Number(process.env.RATE_LIMIT_IP_PER_MINUTE || '600'),
  RATE_LIMIT_AUTH_PER_15_MINUTES: Number(process.env.RATE_LIMIT_AUTH_PER_15_MINUTES || '20'),
  RATE_LIMIT_USER_PER_MINUTE: Number(process.env.RATE_LIMIT_USER_PER_MINUTE || '120'),
};