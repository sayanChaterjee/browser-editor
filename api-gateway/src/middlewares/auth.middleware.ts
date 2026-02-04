import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import logger from '../config/logger';
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
        const cookieName = standardCookie ? 'better-auth.session_token' : '__Secure-better-auth.session_token';

        if (!sessionToken) {
            logger.warn(`No session token found for ${req.path}. Cookies present:`, Object.keys(req.cookies || {}));
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Please log in to access this resource'
            });
        }

        // Verify session by calling better-auth's session endpoint
        try {
            // CRITICAL: Forward the cookie exactly as it was received (prefix matters for Better Auth)
            const sessionResponse = await axios.get(`${config.AUTH_SERVICE_URL}/api/auth/get-session`, {
                headers: {
                    'cookie': `${cookieName}=${sessionToken}`,
                },
                timeout: 3000,
            });

            const session = sessionResponse.data;

            if (!session || !session.user) {
                logger.warn(`Invalid session response for ${req.path}`);
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Invalid or expired session'
                });
            }

            // Inject user context headers for downstream services
            req.headers['x-user-id'] = session.user.id;
            req.headers['x-user-email'] = session.user.email || '';
            req.headers['x-user-name'] = session.user.name || '';

            // Attach to request for convenience
            (req as any).user = session.user;
            (req as any).session = session.session;

            logger.info(`Authenticated request from user: ${session.user.email}`);
            next();
        } catch (sessionError: any) {
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
