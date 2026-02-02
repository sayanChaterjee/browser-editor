import { Request, Response, NextFunction } from 'express';
import { correlationContext } from '../utils/context';

export const correlationMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const correlationId = (req.headers['x-correlation-id'] as string);

    if (correlationId) {
        correlationContext.run(correlationId, () => {
            next();
        });
    } else {
        next();
    }
};
