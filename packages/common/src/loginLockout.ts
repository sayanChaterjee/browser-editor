import { createHash } from 'crypto';
import type { Redis } from 'ioredis';
import { isRedisReady } from './redis';

/**
 * Failed sign-ins counted per email address: after `maxFailures` within `windowSeconds`, the
 * address is locked until the window ends. This stops password guessing against one account
 * from many IPs, which per-IP rate limits can't.
 *
 * Counts live in Redis, so they hold across instances and restarts. While Redis is down they
 * are kept in memory on this instance instead: lockout keeps working (per instance) rather
 * than switching off when Redis does.
 */

export interface LockoutStatus {
  locked: boolean;
  retryAfterSeconds: number;
}

export interface LoginLockout {
  status(email: string): Promise<LockoutStatus>;
  recordFailure(email: string): Promise<void>;
  clear(email: string): Promise<void>;
}

const KEY_PREFIX = 'login-failures:';
// Keys hold a hash, so email addresses never appear in Redis
const keyFor = (email: string) => KEY_PREFIX + createHash('sha256').update(email.trim().toLowerCase()).digest('hex');

// INCR and start the window on the first failure, in one step
const INCREMENT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count
`;

// Bounds memory if Redis stays down during a spray of different addresses
const MAX_MEMORY_ENTRIES = 10_000;

export function createLoginLockout(
  redis: Redis,
  { maxFailures, windowSeconds }: { maxFailures: number; windowSeconds: number },
  onFallback: (operation: string, err?: Error) => void = () => {},
): LoginLockout {
  const memory = new Map<string, { count: number; expiresAt: number }>();

  const fromMemory = (key: string) => {
    const entry = memory.get(key);
    if (entry && entry.expiresAt <= Date.now()) {
      memory.delete(key);
      return undefined;
    }
    return entry;
  };

  // Redis when it's up; memory when it's down or the call fails
  async function withFallback<T>(operation: string, inRedis: () => Promise<T>, inMemory: () => T): Promise<T> {
    if (isRedisReady(redis)) {
      try {
        return await inRedis();
      } catch (err) {
        onFallback(operation, err as Error);
        return inMemory();
      }
    }
    onFallback(operation);
    return inMemory();
  }

  return {
    status: (email) => {
      const key = keyFor(email);
      return withFallback(
        'status',
        async () => {
          const [count, ttl] = await redis.multi().get(key).ttl(key).exec().then((replies) => replies!.map(([, value]) => value));
          return Number(count ?? 0) >= maxFailures
            ? { locked: true, retryAfterSeconds: Math.max(1, Number(ttl)) }
            : { locked: false, retryAfterSeconds: 0 };
        },
        () => {
          const entry = fromMemory(key);
          return entry && entry.count >= maxFailures
            ? { locked: true, retryAfterSeconds: Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000)) }
            : { locked: false, retryAfterSeconds: 0 };
        },
      );
    },

    recordFailure: (email) => {
      const key = keyFor(email);
      return withFallback(
        'recordFailure',
        async () => {
          await redis.eval(INCREMENT, 1, key, windowSeconds);
        },
        () => {
          const entry = fromMemory(key);
          if (entry) {
            entry.count++;
            return;
          }
          if (memory.size >= MAX_MEMORY_ENTRIES) memory.delete(memory.keys().next().value!);
          memory.set(key, { count: 1, expiresAt: Date.now() + windowSeconds * 1000 });
        },
      );
    },

    clear: (email) => {
      const key = keyFor(email);
      memory.delete(key);
      return withFallback(
        'clear',
        async () => {
          await redis.del(key);
        },
        () => {},
      );
    },
  };
}
