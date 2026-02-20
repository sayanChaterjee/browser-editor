import { Request, Response, NextFunction } from 'express';

/**
 * Auth middleware for user-service
 * Expects user context from API Gateway via x-user-id header
 */
export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get user ID from header injected by API Gateway
    const userId = req.headers['x-user-id'] as string;

    if (!userId || userId === 'undefined' || userId === 'null') {
      return res.status(401).json({
        message: 'Unauthorized: Invalid user context',
        hint: 'Please ensure you are logged in and requests go through API Gateway'
      });
    }

    // Attach user info to request
    (req as any).userId = userId;
    (req as any).userName = req.headers['x-user-name'] as string;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
