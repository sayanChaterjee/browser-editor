import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger';
import { runWithContext } from '../utils/context';

/**
 * Correlation middleware that creates an AsyncLocalStorage context
 * All subsequent async operations will have access to the correlation ID
 */
export const correlationMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
    const origin = req.headers['origin'] as string;

    // set the header for response and for req object to track it
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    // Create context and run all subsequent middleware/handlers within it
    runWithContext({ correlationId, origin }, () => {
        // Enhance logger to include correlation ID
        const originalInfo = logger.info.bind(logger);
        const originalError = logger.error.bind(logger);
        const originalWarn = logger.warn.bind(logger);

        logger.info = (message: any, ...meta: any[]) => {
            return originalInfo(`[CID: ${correlationId}] ${message}`, ...meta);
        };
        logger.error = (message: any, ...meta: any[]) => {
            return originalError(`[CID: ${correlationId}] ${message}`, ...meta);
        };
        logger.warn = (message: any, ...meta: any[]) => {
            return originalWarn(`[CID: ${correlationId}] ${message}`, ...meta);
        };

        next();
    });
};
