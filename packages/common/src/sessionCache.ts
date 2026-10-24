import { createHash } from 'crypto';
import type { Redis } from './redis';

// The gateway caches validated sessions so most requests skip the identity-service call.
// identity-service and the gateway revoke entries (ban, sign-out) through the same functions, so the
// key layout is defined only here.

/**
 * How long a validated session is trusted without asking identity-service again. Revocation
 * (ban, sign-out, password change) clears entries explicitly, so this only bounds staleness
 * for changes that bypass those paths. Each entry gets 80-100% of it at random so entries
 * created together don't all expire together (a burst of misses = a stampede on identity).
 */
export const SESSION_CACHE_TTL_SECONDS = 300;

// After a revocation, the user's sessions aren't cached for this long: longer than any session
// check already in flight (the gateway times them out after 3s) could take to write back.
const REVOCATION_BLOCK_SECONDS = 30;

export interface CachedSession {
  userId: string;
  name: string;
  email: string;
}

// Keys hold a hash of the session cookie, never the token itself
const hashToken = (cookieValue: string) => createHash('sha256').update(cookieValue).digest('hex');
const sessionKey = (tokenHash: string) => `session-cache:token:${tokenHash}`;
const userIndexKey = (userId: string) => `session-cache:user:${userId}`;
const blockedKey = (userId: string) => `session-cache:blocked:${userId}`;

// Stores the session unless the user's sessions were revoked in the last TTL: closes the
// race where a check that started before a ban writes its (now stale) result after it.
const CACHE_SCRIPT = `
if redis.call('EXISTS', KEYS[3]) == 1 then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])
redis.call('SADD', KEYS[2], ARGV[2])
redis.call('EXPIRE', KEYS[2], ARGV[4])
return 1`;

export async function getCachedSession(redis: Redis, cookieValue: string): Promise<CachedSession | null> {
  const value = await redis.get(sessionKey(hashToken(cookieValue)));
  return value ? (JSON.parse(value) as CachedSession) : null;
}

const jitteredTtl = () => Math.round(SESSION_CACHE_TTL_SECONDS * (0.8 + 0.2 * Math.random()));

/**
 * Caches a validated session, never past the session's own expiry. Returns false when it
 * wasn't stored (the user's sessions were just revoked, or the session is about to expire).
 */
export async function cacheSession(
  redis: Redis,
  cookieValue: string,
  session: CachedSession,
  sessionExpiresAt: Date,
): Promise<boolean> {
  const ttl = Math.min(jitteredTtl(), Math.floor((sessionExpiresAt.getTime() - Date.now()) / 1000));
  if (!(ttl > 0)) return false;
  const tokenHash = hashToken(cookieValue);
  const stored = await redis.eval(
    CACHE_SCRIPT,
    3,
    sessionKey(tokenHash),
    userIndexKey(session.userId),
    blockedKey(session.userId),
    JSON.stringify(session),
    tokenHash,
    ttl,
    // The user's index outlives every entry it lists
    SESSION_CACHE_TTL_SECONDS,
  );
  return stored === 1;
}

/**
 * Drops every cached session of a user and briefly stops new ones being cached (ban,
 * sign-out, revoked sessions, password change). The next request is checked by identity-service.
 */
export async function forgetUserSessions(redis: Redis, userId: string): Promise<void> {
  await redis.set(blockedKey(userId), '1', 'EX', REVOCATION_BLOCK_SECONDS);
  const tokenHashes = await redis.smembers(userIndexKey(userId));
  await redis.del(userIndexKey(userId), ...tokenHashes.map(sessionKey));
}
