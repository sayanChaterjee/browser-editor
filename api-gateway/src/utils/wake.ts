import axios from 'axios';
import { config } from '../config';
import logger from '../config/logger';

/**
 * Wakes the backend services ahead of need. On Render's free tier an idle service sleeps and
 * takes ~20 s to start on the next request; the frontend calls /api/wake when the landing,
 * login or register page opens, so that start-up overlaps with the user typing instead of
 * following their click.
 *
 * Each service gets at most one /health request per WAKE_INTERVAL_MS, however many pages ask:
 * /api/wake is public, and this keeps it from multiplying traffic to the services.
 */

const WAKE_INTERVAL_MS = 60_000;
// Long enough to wait out a cold start: the request is what keeps the service starting
const WAKE_TIMEOUT_MS = 90_000;

const lastWoken = new Map<string, number>();

export function wakeServices(now = Date.now()): string[] {
  const services = {
    'identity-service': config.IDENTITY_SERVICE_URL,
    'code-service': config.CODE_SERVICE_URL,
    'contest-service': config.CONTEST_SERVICE_URL,
  };
  const pinged: string[] = [];
  for (const [name, url] of Object.entries(services)) {
    if (now - (lastWoken.get(name) ?? 0) < WAKE_INTERVAL_MS) continue;
    lastWoken.set(name, now);
    pinged.push(name);
    // Fire and forget: the caller doesn't wait for anything to start
    axios.get(`${url}/health`, { timeout: WAKE_TIMEOUT_MS }).catch((err) => {
      lastWoken.delete(name); // let the next page retry
      logger.warn(`Wake ${name} failed: ${err.message}`);
    });
  }
  return pinged;
}
