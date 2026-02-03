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
        // DEBUG: Log all incoming headers and cookies
        logger.info('=== AUTH MIDDLEWARE DEBUG ===');
        logger.info(`Path: ${req.path}`);
        logger.info(`Cookie Header: ${req.headers.cookie}`);
        logger.info(`Parsed Cookies:`, req.cookies);
        logger.info(`All Cookie Keys:`, Object.keys(req.cookies || {}));

        // Get session cookie from request - check both possible names
        const sessionToken =
            req.cookies?.['better-auth.session_token'] ||
            req.cookies?.['__Secure-better-auth.session_token'];

        logger.info(`Session Token Found: ${sessionToken ? 'YES' : 'NO'}`);
        if (sessionToken) {
            logger.info(`Token Preview: ${sessionToken.substring(0, 20)}...`);
        }

        if (!sessionToken) {
            logger.warn(`No session token found for ${req.path}. Cookies:`, Object.keys(req.cookies || {}));
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Please log in to access this resource'
            });
        }

        // Verify session by calling better-auth's session endpoint
        try {
            const sessionResponse = await axios.get(`${config.AUTH_SERVICE_URL}/api/auth/get-session`, {
                headers: {
                    'cookie': `better-auth.session_token=${sessionToken}`,
                },
                timeout: 3000,
            });

            const session = sessionResponse.data;

            if (!session || !session.user) {
                logger.warn(`Invalid session for ${req.path}`);
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
            logger.error('Session verification failed:', sessionError.message);
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
