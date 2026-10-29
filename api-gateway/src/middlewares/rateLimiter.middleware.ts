import { Request } from 'express';
import rateLimit, { ClientRateLimitInfo, MemoryStore, Options, Store } from 'express-rate-limit';
import { RedisStore, RedisReply } from 'rate-limit-redis';
import { isRedisReady } from '@ceditor/common';
import redis from '../config/redis';
import { config } from '../config';
import logger from '../config/logger';
import { rateLimitRejections, rateLimitStoreFallbacks } from '../config/metrics';

/**
 * Counters live in Redis so limits hold across gateway instances and restarts. While Redis is
 * down (or a call to it fails) they are counted in this instance's memory instead, so the
 * limits stay on rather than every request being let through.
 */
export class FallbackStore implements Store {
  readonly prefix: string;
  private redisStore?: RedisStore;
  private options?: Options;
  private readonly memory = new MemoryStore();

  constructor(prefix: string, private readonly limiter: string) {
    this.prefix = prefix;
  }

  init(options: Options) {
    this.options = options;
    this.memory.init(options);
  }

  // Created on first use with Redis ready: RedisStore loads its Lua scripts as soon as it is
  // constructed, and against a not-yet-connected client those loads fail unhandled.
  private inRedis(): RedisStore {
    if (!this.redisStore) {
      this.redisStore = new RedisStore({
        prefix: this.prefix,
        sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<RedisReply>,
      });
      this.redisStore.init(this.options!);
    }
    return this.redisStore;
  }

  private async either<T>(inRedis: (store: RedisStore) => Promise<T>, inMemory: () => Promise<T> | T): Promise<T> {
    if (isRedisReady(redis)) {
      try {
        return await inRedis(this.inRedis());
      } catch (err) {
        logger.warn(`Rate limiter ${this.limiter}: Redis call failed, counting in memory: ${(err as Error).message}`);
      }
    }
    rateLimitStoreFallbacks.inc({ limiter: this.limiter });
    return inMemory();
  }

  increment(key: string): Promise<ClientRateLimitInfo> {
    return this.either((store) => store.increment(key), () => this.memory.increment(key));
  }

  get(key: string): Promise<ClientRateLimitInfo | undefined> {
    return this.either((store) => store.get(key), () => this.memory.get(key));
  }

  async decrement(key: string): Promise<void> {
    await this.either((store) => store.decrement(key), () => this.memory.decrement(key));
  }

  async resetKey(key: string): Promise<void> {
    await this.either((store) => store.resetKey(key), () => this.memory.resetKey(key));
  }

  shutdown() {
    this.memory.shutdown();
  }
}

// Counts the rejection, then sends the standard 429 response
const rejectWith = (limiter: string): Options['handler'] => (req, res, next, options) => {
  rateLimitRejections.inc({ limiter });
  res.status(options.statusCode).send(options.message);
};

const common: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Last resort only: FallbackStore already counts in memory when Redis is unavailable
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
  store: new FallbackStore('rl:ip:', 'ip'),
  handler: rejectWith('ip'),
});

// Strict limit on credential endpoints (password guessing, sign-up spam), keyed by IP.
export const authLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: config.RATE_LIMIT_AUTH_PER_15_MINUTES,
  store: new FallbackStore('rl:auth:', 'auth'),
  handler: rejectWith('auth'),
  skip: (req: Request) =>
    req.method !== 'POST' || !/^\/api\/auth\/(sign-in|sign-up|forget-password|reset-password)/.test(req.path),
});

// Per-user limit on the API, applied after authMiddleware has resolved the user.
export const userLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: config.RATE_LIMIT_USER_PER_MINUTE,
  store: new FallbackStore('rl:user:', 'user'),
  handler: rejectWith('user'),
  keyGenerator: (req: Request) => req.user?.id ?? req.clientIp ?? 'unknown',
});
