import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to protect internal microservice routes.
 * Checks for a valid x-internal-secret header before allowing the request.
 */
export function internalSecurity(req: Request, res: Response, next: NextFunction) {
    const secret = req.headers['x-internal-secret'];
    const expectedSecret = process.env.INTERNAL_GATEWAY_SECRET;

    if (!expectedSecret) {
        console.error('[Internal Security] INTERNAL_GATEWAY_SECRET is not defined in environment variables');
        return res.status(500).json({ message: 'Internal Server Error: Missing security configuration' });
    }

    if (secret !== expectedSecret) {
        console.warn(`[Internal Security] Forbidden access attempt from ${req.ip} - URI: ${req.url}`);
        return res.status(403).json({ message: 'Forbidden: Internal access only' });
    }

    next();
}
