import { loadConfig, z, envRequired, envNumber, envBoolean } from '@ceditor/common';
import { normalizeServiceUrl } from '../utils/urlHelper';

const serviceUrl = (fallback: string) => z.string().default(fallback).transform(normalizeServiceUrl);

const schema = z.object({
  PORT: envNumber(3000),
  LOG_LEVEL: z.string().default('info'),
  // Bearer token for /metrics (Prometheus); unset = endpoint disabled
  METRICS_TOKEN: z.string().default(''),
  DEFAULT_TIMEOUT: envNumber(30000),
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3001,http://localhost:3005,http://localhost:3000,http://localhost:3004,http://localhost:3006'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  AUTH_SERVICE_URL: serviceUrl('http://localhost:3001'),
  USER_SERVICE_URL: serviceUrl('http://localhost:3002'),
  CODE_SERVICE_URL: serviceUrl('http://localhost:3003'),
  INTERNAL_GATEWAY_SECRET: envRequired('shared with the backend services'),
  // Number of reverse proxies in front of the gateway whose X-Forwarded-For can be trusted
  // (0 = header ignored). Only affects req.ip; rate limiting uses clientIpMiddleware.
  TRUST_PROXY_HOPS: envNumber(0),
  // Shared with the frontend's /api proxy, which uses it to vouch for the client IP it forwards.
  BFF_SHARED_SECRET: z.string().default(''),
  // Only true where the gateway sits behind Cloudflare (Render), which overwrites this header.
  TRUST_CF_CONNECTING_IP: envBoolean(false),
  RATE_LIMIT_IP_PER_MINUTE: envNumber(600),
  RATE_LIMIT_AUTH_PER_15_MINUTES: envNumber(20),
  RATE_LIMIT_USER_PER_MINUTE: envNumber(120),
});

export const config = {
  SERVICE_NAME: require('../../package.json').name as string,
  ...loadConfig(schema),
};
