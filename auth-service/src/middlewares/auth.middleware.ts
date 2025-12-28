import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import redis from '../config/redis';

const publicRoutes = ['/login', '/register'];

export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const path = req.path.replace(/\/$/, ''); 
  
  const isPublic = 
    path.endsWith('/login') || 
    path.endsWith('/register') || 
    path.endsWith('/health');
  if (isPublic) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const token =
    authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : req.cookies?.token;

  if (!token) {
    return res.status(403).json({ message: 'missing authentication token' });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as {
      id: string;
      email: string;
      name: string;
    };

    const redisKey = `auth:${decoded.id}:${token}`;
    const redisToken = await redis.get(redisKey);

    if (!redisToken) {
      return res.status(401).json({ message: 'unauthorized' });
    }

    req.userId = decoded.id;
    req.token = token;

    return next();
  } catch (err) {
    return res.status(401).json({ message: 'invalid or expired token' });
  }
};
