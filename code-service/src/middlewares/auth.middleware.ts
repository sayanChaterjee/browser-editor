import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import redis from '../config/redis';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      token?: string;
    }
  }
}

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { id: string };
    
    // Check Redis for token (consistency with auth-service)
    const redisKey = `auth:${decoded.id}:${token}`;
    const redisToken = await redis.get(redisKey);

    if (!redisToken) {
      return res.status(401).json({ message: 'Unauthorized or token expired' });
    }

    req.userId = decoded.id;
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
