import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import logger from '../config/logger';

/**
 * Normalize origin by removing trailing slash and converting to lowercase
 */
function normalizeOrigin(origin: string): string {
    if (!origin) return '';
    return origin.replace(/\/$/, '').toLowerCase();
}

/**
 * Check if origin is allowed using robust matching
 * Handles trailing slashes, case sensitivity, and port variations
 */
function isAllowedOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
    if (!origin) return true; // Allow requests without origin (e.g., Postman)

    const normalized = normalizeOrigin(origin);
    return allowedOrigins.some(allowed => normalizeOrigin(allowed) === normalized);
}

/**
 * Production-ready CORS middleware
 * - Handles preflight (OPTIONS) requests
 * - Robust origin matching with normalization
 * - Sets headers for all responses
 * - Runs BEFORE auth/proxy middleware
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
    const origin = req.headers.origin;
    const allowedOrigins = config.ALLOWED_ORIGINS.split(',').map(o => o.trim());

    // Set CORS headers for all responses
    if (origin && isAllowedOrigin(origin, allowedOrigins)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID, Cookie');
        res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
        res.setHeader('Vary', 'Origin');

        logger.info(`Preflight request from origin: ${origin}`);
        return res.status(204).end();
    }

    // Set Vary header for caching
    res.setHeader('Vary', 'Origin');

    next();
}
