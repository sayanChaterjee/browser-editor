import dotenv from "dotenv";
dotenv.config();
import logger from "./config/logger";

import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import axios from "axios";
import cookieParser from "cookie-parser";
import { config } from "./config/index";
import redis from "./config/redis";
import { ipLimiter, authLimiter, userLimiter } from "./middlewares/rateLimiter.middleware";
import { proxyServices } from "./config/services";
import { setupGracefulShutdown } from "./utils/shutdown";
import { correlationMiddleware } from "./middlewares/correlation.middleware";
import { authMiddleware } from "./middlewares/auth.middleware";
import { corsMiddleware } from './middlewares/cors.middleware';
import { errorHandler } from './middlewares/error.middleware';
import { setupAxiosInterceptors } from './utils/axios-interceptors';
import internalClient from './utils/internalClient';

// initialize axios interceptors for auto correlation ID injection
setupAxiosInterceptors();


const app = express();

// Trust proxy - only as many hops as actually sit in front of the gateway, so clients
// can't spoof X-Forwarded-For to dodge IP rate limits (see TRUST_PROXY_HOPS)
app.set("trust proxy", config.TRUST_PROXY_HOPS);

app.use(corsMiddleware);

// 2. Cookie parser - required for session cookies
app.use(cookieParser());

// 3. Helmet - security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // needed for some editor features
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003", "http://localhost:3004", "http://localhost:3005"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
      frameAncestors: ["'none'"], // prevent clickjacking
    },
  },
}));

// 4. Correlation - creates AsyncLocalStorage context for the entire request lifecycle
app.use(correlationMiddleware);

// Health checks sit before the rate limiters so probes never consume limits or get a 429.
// Liveness:
app.get("/health", (req: Request, res: Response) => {
  res.status(200).send("OK");
});

// Readiness: the gateway can route without Redis (rate limiting fails open), so Redis
// is reported but doesn't make it unready.
app.get("/ready", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ready",
    service: config.SERVICE_NAME,
    checks: { redis: redis.status === "ready" ? "up" : "down" },
  });
});

// 5. Rate limiters: per-IP flood backstop, strict per-IP limit on credential endpoints
// (the per-user API limit is applied after authentication below)
app.use(ipLimiter);
app.use(authLimiter);

// apply middleware to log all incoming requests with correlation ID
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Handle OAuth error redirects at root
app.get('/', (req: Request, res: Response) => {
  const error = req.query.error as string;

  if (error) {
    logger.warn(`OAuth error received: ${error}`);
    // Redirect to frontend with error
    const frontendUrl = config.ALLOWED_ORIGINS.split(',')[0].trim();
    return res.redirect(`${frontendUrl}/auth/error?error=${error}`);
  }

  // Regular health check
  res.status(200).json({
    message: "API Gateway is running",
    timestamp: new Date().toISOString()
  });
});



// Apply auth middleware to protected routes (matches /api/v1 and all subpaths)
app.use('/api/v1', authMiddleware, userLimiter);


/**
 * Gateway Aggregation Pattern
 * GET /api/v1/dashboard
 * Aggregates user profile and projects in parallel
 */
app.get("/api/v1/dashboard", async (req: Request, res: Response) => {
  try {
    const correlationId = req.headers['x-correlation-id'];
    const userId = req.headers['x-user-id'];

    logger.info(`Fetching dashboard data for user: ${userId}`);

    const [profileRes, projectsRes] = await Promise.all([
      internalClient.get(`${config.USER_SERVICE_URL}/profile`, {
        headers: {
          'x-user-id': userId,
        }
      }),
      internalClient.get(`${config.CODE_SERVICE_URL}/`, {
        headers: {
          'x-user-id': userId,
        }
      })
    ]);

    res.json({
      user: profileRes.data,
      projects: projectsRes.data,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Dashboard aggregation failed:', error.message);
    res.status(error.response?.status || 500).json({
      message: 'Failed to aggregate dashboard data',
      error: error.message
    });
  }
});



proxyServices(app);

// 404 handler with CORS
app.use((req: Request, res: Response) => {
  logger.warn(`Resource not found: ${req.method} ${req.url}`);

  // Set CORS headers even for 404
  const origin = req.headers.origin as string;
  const allowedOrigins = config.ALLOWED_ORIGINS.split(',');
  if (origin && allowedOrigins.some(o => o.trim().toLowerCase() === origin.toLowerCase())) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.status(404).json({ message: "resource not found" });
});

// Global error handler (MUST BE LAST) - includes CORS headers
app.use(errorHandler);

const startServer = () => {
  try {
    const server = app.listen(config.PORT, () => {
      logger.info(`${config.SERVICE_NAME} running on port ${config.PORT}`);
    });

    setupGracefulShutdown(server);
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
