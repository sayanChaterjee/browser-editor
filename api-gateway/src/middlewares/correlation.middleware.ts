import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { correlationContext } from '../utils/context';

export const correlationMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();

    // Set the header for response and for req object to track it
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    correlationContext.run(correlationId, () => {
        next();
    });
};
