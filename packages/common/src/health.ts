import { Router } from 'express';

export interface DependencyCheck {
  isUp: () => boolean;
  // Required dependencies make the service unready when down; optional ones are reported only.
  required: boolean;
}

/**
 * /health: liveness (the process is up), used by Docker/Render to decide restarts.
 * /ready: readiness, 503 when a required dependency is down, with per-dependency status.
 */
export function healthRoutes(service: string, checks: Record<string, DependencyCheck>): Router {
  const router = Router();

  router.get('/health', (req, res) => {
    res.json({ status: 'ok', service });
  });

  router.get('/ready', (req, res) => {
    const status: Record<string, 'up' | 'down'> = {};
    let ready = true;
    for (const [name, check] of Object.entries(checks)) {
      const up = check.isUp();
      status[name] = up ? 'up' : 'down';
      if (!up && check.required) ready = false;
    }
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', service, checks: status });
  });

  return router;
}
