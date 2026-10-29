import dotenv from "dotenv";
dotenv.config();
import logger from "./config/logger";

import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { config } from "./config/index";
import redis from "./config/redis";
import { metrics } from "./config/metrics";
import { ipLimiter, authLimiter, userLimiter } from "./middlewares/rateLimiter.middleware";
import { clientIpMiddleware } from "./middlewares/clientIp.middleware";
import { proxyServices } from "./config/services";
import { correlationMiddleware, isRedisReady, registerDependencyGauge, setupGracefulShutdown, USER_TOKEN_HEADER } from "@ceditor/common";
import { authMiddleware, sessionCacheInvalidation, stripClientIdentity } from "./middlewares/auth.middleware";
import { userTokenFor } from "./config/userToken";
import { corsMiddleware } from './middlewares/cors.middleware';
import { errorHandler } from './middlewares/error.middleware';
import { setupAxiosInterceptors } from './utils/axios-interceptors';
import internalClient from './utils/internalClient';
import { wakeServices } from './utils/wake';

// initialize axios interceptors for auto correlation ID injection
setupAxiosInterceptors();


const app = express();

// Trust proxy - only as many hops as actually sit in front of the gateway, so clients
// can't spoof X-Forwarded-For to dodge IP rate limits (see TRUST_PROXY_HOPS)
app.set("trust proxy", config.TRUST_PROXY_HOPS);

// Time every request first, so 429s and auth failures are measured too
app.use(metrics.httpMetrics);

app.use(corsMiddleware);

// 2. Cookie parser - required for session cookies
app.use(cookieParser());

// 3. Helmet - security headers. The gateway serves only JSON and redirects, so the policy
// allows nothing to load or run; pages get their own (nonce-based) policy from the frontend.
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"], // prevent clickjacking
    },
  },
}));

// 4. Correlation - creates AsyncLocalStorage context for the entire request lifecycle
app.use(correlationMiddleware);

// Identity comes only from the session: drop any x-user-* / x-user-token the client sent
app.use(stripClientIdentity);

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

// Prometheus metrics (token-protected), before the limiters like the health checks
app.use(metrics.metricsRoute);
registerDependencyGauge(metrics, { redis: { isUp: () => isRedisReady(redis), required: false } });

// 5. Rate limiters: resolve the real client IP first (see clientIpMiddleware), then a per-IP
// flood backstop and a strict per-IP limit on credential endpoints
// (the per-user API limit is applied after authentication below)
app.use(clientIpMiddleware);
app.use(ipLimiter);
app.use(authLimiter);

// apply middleware to log all incoming requests with correlation ID
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Starts sleeping services early (free-tier cold starts); answers at once. Public, after the
// per-IP limiter; see utils/wake.
app.get('/api/wake', (req: Request, res: Response) => {
  res.status(202).json({ waking: wakeServices() });
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

// Sign-out and session revocation clear the gateway's session cache before reaching Better Auth
app.use('/api/auth', sessionCacheInvalidation);


/**
 * Gateway Aggregation Pattern
 * GET /api/v1/dashboard
 * Aggregates user profile and projects in parallel
 */
app.get("/api/v1/dashboard", async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    logger.info(`Fetching dashboard data for user: ${user.id}`);

    const [profileRes, projectsRes] = await Promise.all([
      internalClient.get(`${config.IDENTITY_SERVICE_URL}/users/profile`, {
        headers: { [USER_TOKEN_HEADER]: userTokenFor(user, 'identity-service') }
      }),
      internalClient.get(`${config.CODE_SERVICE_URL}/`, {
        headers: { [USER_TOKEN_HEADER]: userTokenFor(user, 'code-service') }
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

    // Transient Redis errors must not take the gateway down, so unhandled rejections are logged only
    setupGracefulShutdown(server, logger, {
      cleanup: [{ name: 'Redis', run: () => redis.quit() }],
      exitOnUnhandledRejection: false,
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
