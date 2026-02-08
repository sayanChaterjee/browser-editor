import { Router, Request, Response } from 'express';
import { getAuth } from '../lib/auth';
import logger from '../config/logger';

const router = Router();

/**
 * Session validation endpoint for API Gateway
 * GET /api/auth/validate-session
 * 
 * This endpoint validates the session cookie and returns user data if valid.
 * It's called by the API Gateway to verify user sessions.
 */
router.get('/validate-session', async (req: Request, res: Response) => {
    try {
        const auth = getAuth();

        // Use Better Auth's API to get the session
        // This will automatically read the session cookie from the request
        const session = await auth.api.getSession({
            headers: req.headers as any
        });

        // If no session or no user, return 401
        if (!session || !session.user || !session.user.id) {
            logger.warn('Session validation failed: No valid session found');
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'No valid session found'
            });
        }

        // Return the session data
        logger.info(`Session validated for user: ${session.user.email} (ID: ${session.user.id})`);
        return res.status(200).json({
            user: session.user,
            session: session.session
        });
    } catch (error: any) {
        logger.error('Session validation error:', error);
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Session validation failed'
        });
    }
});

export { router as sessionRouter };
