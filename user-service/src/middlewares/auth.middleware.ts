import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      token?: string;
    }
  }
}

/**
 * Trust the headers injected by the API Gateway
 */
export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'] as string;

  if (!userId) {
    return res.status(401).json({ message: 'Authentication required: missing user context' });
  }

  req.userId = userId;
  next();
};
