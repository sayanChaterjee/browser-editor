import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import logger from '../config/logger';
import { sessionCheckDuration } from '../config/metrics';
import axios from 'axios';

/**
 * Auth middleware that extracts better-auth session from cookies
 * and injects user context into request headers for downstream services
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        // Get session cookie from request - check both possible names
        const standardCookie = req.cookies?.['better-auth.session_token'];
        const secureCookie = req.cookies?.['__Secure-better-auth.session_token'];

        const sessionToken = standardCookie || secureCookie;

        if (!sessionToken) {
            logger.warn(`No session token found for ${req.path}. Cookies present:`, Object.keys(req.cookies || {}));
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Please log in to access this resource'
            });
        }

        // Verify session by calling better-auth's session endpoint
        const endSessionCheck = sessionCheckDuration.startTimer();
        try {
            // Forward all cookies as received: besides the session token, Better Auth's signed
            // session_data cookie lets it validate the session without a database lookup.
            const sessionResponse = await axios.get(`${config.AUTH_SERVICE_URL}/api/auth/get-session`, {
                headers: {
                    'cookie': req.headers.cookie,
                },
                timeout: 3000,
            });

            // Pass refreshed cookies back to the browser (renewed session_data cache and the
            // extended session expiry); otherwise the cache goes cold after 5 minutes.
            const refreshedCookies = sessionResponse.headers['set-cookie'];
            if (refreshedCookies) {
                res.append('Set-Cookie', refreshedCookies);
            }

            const session = sessionResponse.data;

            if (!session || !session.user || !session.user.id ||
                session.user.id === 'undefined' || session.user.id === 'null') {
                endSessionCheck({ result: 'invalid' });
                logger.warn(`Invalid or incomplete session for ${req.path}. User ID: ${session?.user?.id}`);
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Invalid or expired session context'
                });
            }

            endSessionCheck({ result: 'valid' });

            // Inject user context headers for downstream services - ONLY if valid
            req.headers['x-user-id'] = session.user.id;
            req.headers['x-user-name'] = session.user.name || '';
            req.headers['x-user-email'] = (session.user.email || '').toLowerCase();

            // Attach to request for convenience
            (req as any).user = session.user;
            (req as any).session = session.session;

            logger.info(`Authenticated request from user: ${session.user.name || session.user.id} (ID: ${session.user.id})`);
            next();
        } catch (sessionError: any) {
            endSessionCheck({ result: 'error' });
            logger.error(`Session verification failed via ${config.AUTH_SERVICE_URL}:`, sessionError.message);
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid or expired session'
            });
        }
    } catch (error) {
        logger.error('Auth middleware error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
