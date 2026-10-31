import { createHash } from 'crypto';
import type { CachedSession } from '@ceditor/common';

/**
 * Fallback session cache in this gateway's memory, used only while Redis is unavailable, so
 * a Redis outage doesn't send every request to identity-service.
 *
 * Entries live at most MEMORY_TTL_MS. Revocations made by identity-service during the outage
 * (a ban) can only clear Redis, so this short life is what bounds them; sign-out through the
 * gateway clears the user's entries here directly.
 */
export const MEMORY_TTL_MS = 30_000;
const MAX_ENTRIES = 5_000;

const entries = new Map<string, { session: CachedSession; expiresAt: number }>();
const keyOf = (cookie: string) => createHash('sha256').update(cookie).digest('hex');

export function fromMemory(cookie: string, now = Date.now()): CachedSession | null {
  const key = keyOf(cookie);
  const entry = entries.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    entries.delete(key);
    return null;
  }
  return entry.session;
}

/** Remembers a validated session, never past the session's own expiry. */
export function rememberInMemory(cookie: string, session: CachedSession, sessionExpiresAt: Date, now = Date.now()) {
  const expiresAt = Math.min(now + MEMORY_TTL_MS, sessionExpiresAt.getTime());
  if (expiresAt <= now) return;
  // Oldest first out (Map keeps insertion order)
  if (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value!);
  entries.set(keyOf(cookie), { session, expiresAt });
}

export function forgetInMemory(userId: string) {
  for (const [key, entry] of entries) if (entry.session.userId === userId) entries.delete(key);
}

export function clearMemorySessions() {
  entries.clear();
}
