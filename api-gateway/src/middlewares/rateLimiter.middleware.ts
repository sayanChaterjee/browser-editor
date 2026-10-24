import { Request } from 'express';
import rateLimit, { Options } from 'express-rate-limit';
import { RedisStore, RedisReply } from 'rate-limit-redis';
import redis from '../config/redis';
import { config } from '../config';

// Counters live in Redis so limits hold across gateway instances and restarts.
const redisStore = (prefix: string) =>
  new RedisStore({
    prefix,
    sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<RedisReply>,
  });

const common: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // If Redis is unavailable, serve the request rather than failing it.
  passOnStoreError: true,
  // Keys come from clientIpMiddleware, not req.ip, so the X-Forwarded-For checks don't apply.
  keyGenerator: (req: Request) => req.clientIp ?? 'unknown',
  validate: { trustProxy: false, xForwardedForHeader: false },
  message: { error: 'Too Many Requests', message: 'Rate limit exceeded, please slow down' },
};

// Backstop against floods, keyed by client IP. Generous on purpose: a contest in a
// lab puts many users behind one public IP.
export const ipLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: config.RATE_LIMIT_IP_PER_MINUTE,
  store: redisStore('rl:ip:'),
});

// Strict limit on credential endpoints (password guessing, sign-up spam), keyed by IP.
export const authLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: config.RATE_LIMIT_AUTH_PER_15_MINUTES,
  store: redisStore('rl:auth:'),
  skip: (req: Request) =>
    req.method !== 'POST' || !/^\/api\/auth\/(sign-in|sign-up|forget-password|reset-password)/.test(req.path),
});

// Per-user limit on the API, applied after authMiddleware has resolved the user.
export const userLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: config.RATE_LIMIT_USER_PER_MINUTE,
  store: redisStore('rl:user:'),
  keyGenerator: (req: Request) => (req as any).user?.id ?? req.clientIp ?? 'unknown',
});
