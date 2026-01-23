import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import logger from '../config/logger';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Paths that don't require authentication
    const publicPaths = ['/health', '/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/refresh'];
    if (publicPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn(`Unauthorized access attempt: No token provided for ${req.path}`);
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, config.AUTH_JWT_SECRET) as any;

        // Inject user info into headers for downstream services
        req.headers['x-user-id'] = decoded.id;
        req.headers['x-user-role'] = decoded.role || 'user';

        // Also attach to req object for internal gateway use (like dashboard aggregation)
        (req as any).user = decoded;

        next();
    } catch (error) {
        logger.error('JWT Verification failed:', error);
        return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
};
