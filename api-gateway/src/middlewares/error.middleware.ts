import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { getOrigin } from '../utils/context';
import { config } from '../config';

/**
 * Normalize origin for CORS header setting
 */
function normalizeOrigin(origin: string): string {
    if (!origin) return '';
    return origin.replace(/\/$/, '').toLowerCase();
}

/**
 * Check if origin is allowed
 */
function isAllowedOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
    if (!origin) return false;

    const normalized = normalizeOrigin(origin);
    return allowedOrigins.some(allowed => normalizeOrigin(allowed) === normalized);
}

/**
 * Global error handler middleware
 * Ensures CORS headers are included even on errors
 * Formats error responses consistently
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    // Get origin from request context or  headers
    const origin = getOrigin() || req.headers.origin as string;
    const allowedOrigins = config.ALLOWED_ORIGINS.split(',').map(o => o.trim());

    // Always set CORS headers on error responses
    if (origin && isAllowedOrigin(origin, allowedOrigins)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Log the error with context
    logger.error(`Error occurred: ${err.message}`, {
        stack: err.stack,
        url: req.url,
        method: req.method,
    });

    // Determine status code
    const statusCode = err.statusCode || err.status || 500;

    // Format error response
    const errorResponse: any = {
        error: err.name || 'Error',
        message: err.message || 'Internal server error',
    };

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development') {
        errorResponse.stack = err.stack;
    }

    res.status(statusCode).json(errorResponse);
}
