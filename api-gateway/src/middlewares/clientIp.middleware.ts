import { Request, Response, NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { config } from '../config';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      clientIp?: string;
    }
  }
}

const header = (req: Request, name: string): string | undefined => {
  const value = req.headers[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

// Compare digests so the check takes the same time whatever the input.
const secretMatches = (provided: string | undefined): boolean => {
  if (!config.BFF_SHARED_SECRET || !provided) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(provided), digest(config.BFF_SHARED_SECRET));
};

/**
 * Resolves the real client IP once, for the IP-based rate limiters.
 *
 * Requests reach the gateway through several proxies (browser -> Vercel /api proxy ->
 * Cloudflare -> Render load balancer), so counting X-Forwarded-For hops is fragile.
 * Instead, in order of trust:
 *  1. The Vercel proxy proves itself with a shared secret and passes the client IP.
 *  2. Cloudflare's CF-Connecting-IP (it overwrites any client-sent value), for direct
 *     callers, only where the gateway really sits behind Cloudflare.
 *  3. The socket address (local development).
 * Both proxy headers are stripped so they never reach downstream services.
 */
export function clientIpMiddleware(req: Request, res: Response, next: NextFunction) {
  const fromProxy = secretMatches(header(req, 'x-bff-secret')) ? header(req, 'x-client-ip') : undefined;
  const fromCloudflare = config.TRUST_CF_CONNECTING_IP ? header(req, 'cf-connecting-ip') : undefined;

  req.clientIp = fromProxy ?? fromCloudflare ?? req.ip ?? 'unknown';

  delete req.headers['x-bff-secret'];
  delete req.headers['x-client-ip'];
  next();
}
