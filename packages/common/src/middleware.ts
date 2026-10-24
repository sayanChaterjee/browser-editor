import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { runWithContext } from './context';
import type { Logger } from './logger';

/**
 * Runs the rest of the request inside a context carrying its correlation ID (taken from
 * x-correlation-id or generated), so logs and outgoing calls can be tied together.
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();
  const origin = req.headers['origin'] as string | undefined;

  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  runWithContext({ correlationId, origin }, () => next());
}

/**
 * Protects internal routes: only requests carrying the gateway's shared secret
 * (x-internal-secret) get through.
 */
export function internalSecurity(expectedSecret: string, logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!expectedSecret) {
      logger.error('[Internal Security] INTERNAL_GATEWAY_SECRET is not configured');
      return res.status(500).json({ message: 'Internal Server Error: Missing security configuration' });
    }

    if (req.headers['x-internal-secret'] !== expectedSecret) {
      logger.warn(`[Internal Security] Forbidden access attempt from ${req.ip} - URI: ${req.url}`);
      return res.status(403).json({ message: 'Forbidden: Internal access only' });
    }

    next();
  };
}
