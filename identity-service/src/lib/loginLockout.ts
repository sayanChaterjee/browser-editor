import { createLoginLockout } from '@ceditor/common';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { config } from '../config';
import logger from '../config/logger';
import { loginLockoutEvents } from '../config/metrics';
import redis from '../config/redis';

const lockout = createLoginLockout(
  redis,
  { maxFailures: config.LOGIN_MAX_FAILURES, windowSeconds: config.LOGIN_LOCKOUT_MINUTES * 60 },
  (operation, err) => {
    loginLockoutEvents.inc({ event: 'fallback' });
    logger.warn(`Login lockout using memory (${operation}): ${err?.message ?? 'Redis not ready'}`);
  },
);

const SIGN_IN = '/sign-in/email';
const emailOf = (body: unknown) => {
  const email = (body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' && email ? email : null;
};

// Before email sign-in: refuse a locked address without checking the password
export const lockoutBeforeSignIn = createAuthMiddleware(async (ctx) => {
  const email = ctx.path === SIGN_IN ? emailOf(ctx.body) : null;
  if (!email) return;
  const { locked, retryAfterSeconds } = await lockout.status(email);
  if (locked) {
    loginLockoutEvents.inc({ event: 'blocked' });
    throw new APIError(
      'TOO_MANY_REQUESTS',
      { message: `Too many failed sign-in attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.` },
      { 'Retry-After': String(retryAfterSeconds) },
    );
  }
});

// After: a wrong email/password (401) counts; a successful sign-in clears the count
export const lockoutAfterSignIn = createAuthMiddleware(async (ctx) => {
  const email = ctx.path === SIGN_IN ? emailOf(ctx.body) : null;
  if (!email) return;
  const result = ctx.context.returned;
  if (result instanceof APIError) {
    if (result.statusCode === 401) {
      loginLockoutEvents.inc({ event: 'failure' });
      await lockout.recordFailure(email);
    }
  } else if (result) {
    await lockout.clear(email);
  }
});
