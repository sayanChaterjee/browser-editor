import { Request, Response, NextFunction } from 'express';
import { Role, userFromRequest } from '@ceditor/common';
import { config } from '../config';
import logger from '../config/logger';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userName?: string;
      userEmail?: string;
      userRole?: Role;
      token?: string;
    }
  }
}

// The user comes only from the token the gateway signs for this service; plain x-user-*
// headers are not trusted.
export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const user = userFromRequest(req, config.USER_TOKEN_PUBLIC_KEY, config.SERVICE_NAME, (reason) =>
    logger.warn(`Rejected user token on ${req.method} ${req.originalUrl}: ${reason}`),
  );

  if (!user) {
    return res.status(401).json({
      message: 'Unauthorized: Invalid user context',
      hint: 'Please ensure you are logged in and requests go through API Gateway'
    });
  }

  req.userId = user.id;
  req.userName = user.name;
  req.userEmail = user.email;
  req.userRole = user.role;
  next();
};
