import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

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

// The gateway validates the session and passes the user in headers (requests are already
// authenticated by internalSecurity as coming from the gateway).
export const requireUser = (req: Request, res: Response, next: NextFunction) => {
  const id = req.headers['x-user-id'] as string | undefined;
  if (!id) {
    return res.status(401).json({ message: 'Unauthorized: missing user context' });
  }
  const email = ((req.headers['x-user-email'] as string) || '').toLowerCase();
  req.userContext = {
    id,
    name: (req.headers['x-user-name'] as string) || '',
    email,
    isAdmin: config.ADMIN_EMAILS.includes(email),
  };
  next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.userContext?.isAdmin) {
    return res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
  next();
};
