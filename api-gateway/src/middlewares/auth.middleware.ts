import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import {
    CachedSession,
    cacheSession,
    forgetUserSessions,
    getCachedSession,
    isRedisReady,
    toRole,
    LEGACY_USER_HEADERS,
    USER_TOKEN_HEADER,
} from '@ceditor/common';
import { config } from '../config';
import logger from '../config/logger';
import redis from '../config/redis';
import { sessionCacheLookups, sessionCheckDuration } from '../config/metrics';
import { forgetInMemory, fromMemory, rememberInMemory } from './memorySessionCache';

const SESSION_COOKIES = ['__Secure-better-auth.session_token', 'better-auth.session_token'];

const sessionCookie = (req: Request): string | undefined =>
    SESSION_COOKIES.map((name) => req.cookies?.[name]).find(Boolean);

class IdentityUnavailableError extends Error {}

// Redis unavailable: the in-memory fallback answers instead (memory-hit / memory-miss)
function fromFallback(cookie: string): CachedSession | null {
    const session = fromMemory(cookie);
    sessionCacheLookups.inc({ result: session ? 'memory-hit' : 'memory-miss' });
    return session;
}

async function fromCache(cookie: string): Promise<CachedSession | null> {
    if (!isRedisReady(redis)) return fromFallback(cookie);
    try {
        const session = await getCachedSession(redis, cookie);
        sessionCacheLookups.inc({ result: session ? 'hit' : 'miss' });
        return session;
    } catch (err: any) {
        logger.warn(`Session cache read failed: ${err.message}`);
        return fromFallback(cookie);
    }
}

interface ValidatedSession {
    session: CachedSession;
    expiresAt: Date;
}

/**
 * Asks identity-service (Better Auth) for the session. The cookie cache is bypassed so the
 * answer comes from the database: a banned or signed-out user can't pass on a still-valid
 * session_data cookie. Returns null for no/invalid session.
 */
async function fromIdentity(req: Request, res?: Response): Promise<ValidatedSession | null> {
    let response;
    try {
        response = await axios.get(`${config.IDENTITY_SERVICE_URL}/api/auth/get-session`, {
            params: { disableCookieCache: true },
            headers: { cookie: req.headers.cookie },
            timeout: 3000,
        });
    } catch (err: any) {
        // identity-service answered with an error status: treat as not authenticated
        if (err.response) return null;
        throw new IdentityUnavailableError(err.message);
    }

    // Pass refreshed cookies (extended session expiry) back to the browser
    const refreshedCookies = response.headers['set-cookie'];
    if (res && refreshedCookies) {
        res.append('Set-Cookie', refreshedCookies);
    }

    const user = response.data?.user;
    if (!user?.id || user.banned) return null;
    return {
        session: { userId: user.id, name: user.name || '', email: (user.email || '').toLowerCase(), role: toRole(user.role) },
        expiresAt: new Date(response.data.session?.expiresAt),
    };
}

/**
 * Mounted first: identity headers from the client are dropped, so nothing in the gateway or
 * behind it can mistake them for the gateway's own.
 */
export function stripClientIdentity(req: Request, res: Response, next: NextFunction) {
    for (const header of [...LEGACY_USER_HEADERS, USER_TOKEN_HEADER]) delete req.headers[header];
    next();
}

/**
 * Authenticates /api/v1 requests and sets req.user; the proxy passes it to the services as a
 * signed token (see config/userToken). Sessions validated by identity-service are cached in Redis for
 * SESSION_CACHE_TTL_SECONDS, so most requests cost one Redis read instead of an HTTP call.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const cookie = sessionCookie(req);
    if (!cookie) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Please log in to access this resource'
        });
    }

    const endSessionCheck = sessionCheckDuration.startTimer();
    let source = 'cache';
    let session = await fromCache(cookie);

    if (!session) {
        source = 'identity';
        let validated: ValidatedSession | null;
        try {
            validated = await fromIdentity(req, res);
        } catch (err: any) {
            endSessionCheck({ source, result: 'error' });
            logger.error(`Session verification failed via ${config.IDENTITY_SERVICE_URL}: ${err.message}`);
            // Not a 401: the session may be fine, and a 401 would sign the user out
            return res.status(503).json({
                error: 'Service Unavailable',
                message: 'Could not verify your session, please retry'
            });
        }

        session = validated?.session ?? null;
        if (validated && isRedisReady(redis)) {
            cacheSession(redis, cookie, validated.session, validated.expiresAt)
                .catch((err) => logger.warn(`Session cache write failed: ${err.message}`));
        } else if (validated) {
            rememberInMemory(cookie, validated.session, validated.expiresAt);
        }
    }

    if (!session) {
        endSessionCheck({ source, result: 'invalid' });
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or expired session'
        });
    }

    endSessionCheck({ source, result: 'valid' });

    req.user = { id: session.userId, name: session.name, email: session.email, role: toRole(session.role) };

    logger.debug(`Authenticated request from user ${session.userId} (${source})`);
    next();
}

// Better Auth endpoints (relative to /api/auth) after which cached sessions are stale
const CHANGES_SESSIONS = /^\/(sign-out|revoke-session|revoke-sessions|revoke-other-sessions|change-password|update-user|delete-user)$/;

/**
 * Mounted on /api/auth before the proxy: drops the user's cached sessions when the request
 * is about to end or change them, so sign-out and revocation take effect immediately.
 * All of the user's entries go (not just this cookie's), which also blocks re-caching by a
 * session check already in flight; the cost is one identity-service call per other device.
 */
export async function sessionCacheInvalidation(req: Request, res: Response, next: NextFunction) {
    const cookie = sessionCookie(req);
    if (req.method !== 'POST' || !CHANGES_SESSIONS.test(req.path) || !cookie) return next();

    // The memory fallback (filled while Redis is down) is cleared here directly
    const remembered = fromMemory(cookie);
    if (remembered) forgetInMemory(remembered.userId);
    if (!isRedisReady(redis)) return next();

    try {
        const userId = (await getCachedSession(redis, cookie))?.userId ?? (await fromIdentity(req))?.session.userId;
        if (userId) await forgetUserSessions(redis, userId);
    } catch (err: any) {
        logger.warn(`Session cache invalidation failed for ${req.path}: ${err.message}`);
    }
    next();
}
