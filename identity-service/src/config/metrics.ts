import { Request } from 'express';
import { createMetrics, prom } from '@ceditor/common';
import { config } from '.';

// Better Auth serves every /api/auth/* endpoint from one handler, so there is no Express
// route pattern; label by path instead. Its endpoint set is finite, and unknown paths
// (404) stay "unmatched" so arbitrary URLs can't create new label values.
const routeLabel = (req: Request) => {
  if (req.route) return `${req.baseUrl}${req.route.path}`;
  if (req.baseUrl === '/api/auth' && req.res?.statusCode !== 404) return `/api/auth${req.path}`;
  return 'unmatched';
};

export const metrics = createMetrics(config.SERVICE_NAME, { token: config.METRICS_TOKEN, routeLabel });

export const eventsPublished = new prom.Counter({
  name: 'events_published_total',
  help: 'Events sent to Kafka, by type and result (published, failed = dropped after retries)',
  labelNames: ['type', 'result'] as const,
  registers: [metrics.registry],
});

export const loginLockoutEvents = new prom.Counter({
  name: 'login_lockout_events_total',
  help: 'Per-email sign-in lockout: failure (counted), blocked (refused while locked), fallback (Redis unavailable, counted in memory)',
  labelNames: ['event'] as const,
  registers: [metrics.registry],
});
