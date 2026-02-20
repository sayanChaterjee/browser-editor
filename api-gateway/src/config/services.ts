import { Application, Request, Response } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import CircuitBreaker from 'opossum';
import { config } from './index';
import logger from './logger';
import { ProxyErrorResponse, ServiceConfig } from '../types/index';

class ServiceProxy {
  private static readonly serviceConfigs: ServiceConfig[] = [
    {
      path: '/api/auth',
      url: config.AUTH_SERVICE_URL,
      // Proxy strips '/api/auth' from the request, leaving the rest
      // We need to add '/api/auth' back for the auth service
      // Example: /api/auth/sign-in/google -> /sign-in/google (stripped) -> /api/auth/sign-in/google (rewritten)
      pathRewrite: { '^/': '/api/auth/' },
      name: 'auth-service',
      timeout: 60000,
    },
    {
      path: '/api/v1/user',
      url: config.USER_SERVICE_URL || 'http://localhost:3002',
      pathRewrite: { '^/api/v1/user': '' },
      name: 'user-service',
      timeout: 60000,
    },
    {
      path: '/api/v1/code',
      url: config.CODE_SERVICE_URL || 'http://localhost:3003',
      pathRewrite: { '^/api/v1/code': '' },
      name: 'code-service',
      timeout: 60000,
    },
  ];

  // Map to store circuit breakers for each service
  private static breakers: Map<string, CircuitBreaker> = new Map();

  private static createProxyOptions(service: ServiceConfig): Options {
    return {
      target: service.url,
      changeOrigin: true,
      pathRewrite: service.pathRewrite,
      timeout: service.timeout || config.DEFAULT_TIMEOUT,
      logger: logger,
      // CRITICAL: Preserve cookies for auth
      cookieDomainRewrite: false,
      preserveHeaderKeyCase: true,
      on: {
        error: ServiceProxy.handleProxyError,
        proxyReq: (proxyReq, req: any) => {
          // 1. Header Hydration: Strip Authorization, inject user context and correlation ID
          proxyReq.removeHeader('Authorization');

          // Debug logging for auth service
          if (service.name === 'auth-service') {
            logger.info(`Auth proxy: ${req.method} ${req.url} -> ${proxyReq.path}`);
          }

          if (req.headers['x-user-id']) {
            proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
          }
          if (req.headers['x-user-role']) {
            proxyReq.setHeader('x-user-role', req.headers['x-user-role']);
          }
          if (req.headers['x-correlation-id']) {
            proxyReq.setHeader('x-correlation-id', req.headers['x-correlation-id']);
          }

          // Forward internal security secret
          const internalSecret = config.INTERNAL_GATEWAY_SECRET;
          if (internalSecret) {
            proxyReq.setHeader('x-internal-secret', internalSecret);
          }

          // Forward cookies from client to auth service
          if (req.headers.cookie) {
            proxyReq.setHeader('cookie', req.headers.cookie);
          }
        },
        proxyRes: (proxyRes, req: any, res: any) => {
          // CRITICAL: Forward Set-Cookie headers from auth service to client
          // This is essential for OAuth session cookies to work
          const setCookieHeaders = proxyRes.headers['set-cookie'];
          if (setCookieHeaders) {
            res.setHeader('set-cookie', setCookieHeaders);
          }
        },
      },
    };
  }

  private static handleProxyError(err: Error, req: any, res: any): void {
    logger.error(`Proxy error for ${req.path}:`, err);

    res.status(503).json({
      message: 'Service unavailable',
      status: 503,
      timestamp: new Date().toISOString(),
    });
  }

  public static setupProxy(app: Application): void {
    ServiceProxy.serviceConfigs.forEach((service) => {
      const proxyOptions = ServiceProxy.createProxyOptions(service);
      const proxyMiddleware = createProxyMiddleware(proxyOptions);

      // 2. Circuit Breaker Integration
      const breaker = new CircuitBreaker(
        (req: Request, res: Response, next: any) => {
          return new Promise((resolve, reject) => {
            const onEnd = () => {
              cleanup();
              resolve(true);
            };

            const onError = (err: Error) => {
              cleanup();
              reject(err);
            };

            const cleanup = () => {
              res.removeListener('finish', onEnd);
              res.removeListener('close', onEnd);
              res.removeListener('error', onError);
            };

            res.on('finish', onEnd);
            res.on('close', onEnd);
            res.on('error', onError);

            // @ts-ignore
            proxyMiddleware(req, res, (err) => {
              if (err) {
                onError(err);
              }
            });
          });
        },
        {
          timeout: service.timeout || 5000,
          errorThresholdPercentage: 50,
          resetTimeout: 30000,
        }
      );

      breaker.fallback((req: Request, res: Response) => {
        logger.warn(`Circuit breaker tripped for ${service.name}. Returning fallback.`);

        if (service.name === 'code-service') {
          return res.status(200).json({
            message: "Service Temporarily Degraded",
            projects: [],
            status: "fallback"
          });
        }

        return res.status(503).json({
          message: `Service ${service.name} is temporarily unavailable. Please try again later.`,
          status: 503
        });
      });

      this.breakers.set(service.name, breaker);

      // Wrapper middleware to use the breaker
      app.use(service.path, (req, res, next) => {
        breaker.fire(req, res, next).catch((err) => {
          if (!res.headersSent) {
            ServiceProxy.handleProxyError(err, req, res);
          }
        });
      });

      logger.info(`Configured proxy for ${service.name} at ${service.path} with Circuit Breaker`);
    });
  }
}

export const proxyServices = (app: Application): void => {
  ServiceProxy.setupProxy(app);
};