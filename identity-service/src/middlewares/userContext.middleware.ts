import { Request, Response, NextFunction } from 'express';
import { userFromRequest } from '@ceditor/common';
import { config } from '../config';
import logger from '../config/logger';

export interface UserContext {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    userContext?: UserContext;
  }
}

// The gateway validates the session and passes the user as a token signed for this service;
// plain x-user-* headers are not trusted (internalSecurity alone would let anyone holding the
// shared secret act as any user).
export const requireUser = (req: Request, res: Response, next: NextFunction) => {
  const user = userFromRequest(req, config.USER_TOKEN_PUBLIC_KEY, config.SERVICE_NAME, (reason) =>
    logger.warn(`Rejected user token on ${req.method} ${req.originalUrl}: ${reason}`),
  );
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized: missing user context' });
  }
  // The role comes from identity-service, signed into the token by the gateway
  req.userContext = { ...user, isAdmin: user.role === 'admin' };
  next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.userContext?.isAdmin) {
    return res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
  next();
};
