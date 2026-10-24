import { createHash, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response, Router } from 'express';
import client from 'prom-client';
import type { DependencyCheck } from './health';

export { client as prom };

export interface MetricsOptions {
  // /metrics requires `Authorization: Bearer <token>`; without a token it's disabled (404),
  // so a service never exposes metrics publicly by accident.
  token: string;
  // Labels a request's route. Defaults to the matched Express route pattern; services that
  // proxy (the gateway) pass their own to keep label cardinality bounded.
  routeLabel?: (req: Request) => string;
}

export interface Metrics {
  registry: client.Registry;
  httpMetrics: (req: Request, res: Response, next: NextFunction) => void;
  metricsRoute: Router;
}

const defaultRouteLabel = (req: Request) => (req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched');

const tokenMatches = (header: string | undefined, token: string) => {
  const provided = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return provided.length > 0 && timingSafeEqual(digest(provided), digest(token));
};

export function createMetrics(service: string, { token, routeLabel = defaultRouteLabel }: MetricsOptions): Metrics {
  const registry = new client.Registry();
  registry.setDefaultLabels({ service });
  // Process and Node.js runtime metrics: CPU, memory, event-loop lag, GC
  client.collectDefaultMetrics({ register: registry });

  const httpDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration by method, route and status code',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  const httpMetrics = (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/metrics') return next();
    const end = httpDuration.startTimer();
    res.on('finish', () => {
      end({ method: req.method, route: routeLabel(req), status_code: String(res.statusCode) });
    });
    next();
  };

  const metricsRoute = Router();
  metricsRoute.get('/metrics', async (req, res) => {
    if (!token) return res.status(404).send('Not Found');
    if (!tokenMatches(req.headers.authorization, token)) return res.status(401).send('Unauthorized');
    res.setHeader('Content-Type', registry.contentType);
    res.send(await registry.metrics());
  });

  return { registry, httpMetrics, metricsRoute };
}

/** Exposes each dependency's status (the same checks as /ready) as dependency_up{dependency}. */
export function registerDependencyGauge(metrics: Metrics, checks: Record<string, DependencyCheck>): void {
  new client.Gauge({
    name: 'dependency_up',
    help: '1 when the dependency is reachable, 0 when it is down',
    labelNames: ['dependency', 'required'] as const,
    registers: [metrics.registry],
    collect() {
      for (const [dependency, check] of Object.entries(checks)) {
        this.set({ dependency, required: String(check.required) }, check.isUp() ? 1 : 0);
      }
    },
  });
}
