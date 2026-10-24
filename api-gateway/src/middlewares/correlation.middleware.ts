import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runWithContext } from '../utils/context';

/**
 * Correlation middleware that creates an AsyncLocalStorage context
 * All subsequent async operations will have access to the correlation ID
 * (the logger reads it from the context, see config/logger.ts)
 */
export const correlationMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
    const origin = req.headers['origin'] as string;

    // set the header for response and for req object to track it
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    // Create context and run all subsequent middleware/handlers within it
    runWithContext({ correlationId, origin }, () => next());
};
