import { Request } from 'express';
import { createMetrics, prom } from '@ceditor/common';
import { config } from '.';

// Proxied requests have no Express route pattern; label them by upstream prefix so the
// label set stays bounded whatever paths clients send.
const PROXIED_PREFIXES = ['/api/auth', '/api/v1/user', '/api/v1/code', '/api/v1/contest'];

const routeLabel = (req: Request) => {
  if (req.route) return `${req.baseUrl}${req.route.path}`;
  const path = req.originalUrl.split('?')[0];
  const prefix = PROXIED_PREFIXES.find((p) => path === p || path.startsWith(`${p}/`));
  return prefix ? `${prefix}/*` : 'unmatched';
};

export const metrics = createMetrics(config.SERVICE_NAME, { token: config.METRICS_TOKEN, routeLabel });
const registers = [metrics.registry];

export const rateLimitRejections = new prom.Counter({
  name: 'rate_limit_rejections_total',
  help: 'Requests rejected with 429, by limiter (ip, auth, user)',
  labelNames: ['limiter'] as const,
  registers,
});

// Every authenticated API request asks auth-service to validate the session
export const sessionCheckDuration = new prom.Histogram({
  name: 'session_check_duration_seconds',
  help: 'Gateway -> auth-service session validation time, by result (valid, invalid, error)',
  labelNames: ['result'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 3],
  registers,
});
