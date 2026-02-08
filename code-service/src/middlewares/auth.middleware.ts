import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      token?: string;
    }
  }
}

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    if (!userId || userId === 'undefined' || userId === 'null') {
      return res.status(401).json({
        message: 'Unauthorized: Invalid user context',
        hint: 'Please ensure you are logged in and requests go through API Gateway'
      });
    }

    req.userId = userId;
    (req as any).userEmail = req.headers['x-user-email'] as string;
    (req as any).userName = req.headers['x-user-name'] as string;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
