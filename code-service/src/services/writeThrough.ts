import { isValidObjectId } from 'mongoose';
import Project from '../models/project.model';
import redis from '../config/redis';
import logger from '../config/logger';

// Saves go to MongoDB directly while Redis is down (write-through instead of write-behind).
// When Redis comes back it still holds pre-outage copies of those projects (buffer, caches),
// which are now older than MongoDB; they are dropped on reconnect.

export interface Fragments {
  html?: string;
  css?: string;
  js?: string;
  updatedAt: string; // ISO time of the edit
}

/**
 * Filter for "MongoDB holds older content than this edit". The flusher and write-through
 * only write when it matches, so a stale Redis buffer can never overwrite newer content.
 */
export const olderContentThan = (editedAt: Date) => ({
  $or: [{ contentUpdatedAt: { $lt: editedAt } }, { contentUpdatedAt: { $exists: false } }],
});

/** Content fields of an update, with contentUpdatedAt and updatedAt set to the edit time. */
export function contentUpdate({ html, css, js, updatedAt }: Fragments) {
  const at = new Date(updatedAt);
  return {
    ...(html !== undefined && { html }),
    ...(css !== undefined && { css }),
    ...(js !== undefined && { js }),
    contentUpdatedAt: at,
    updatedAt: at,
  };
}

// projectId -> { userId, time of the latest write-through }
const writtenThrough = new Map<string, { userId: string; at: string }>();

/** Writes an edit straight to MongoDB. Returns false when the project isn't the user's. */
export async function writeThrough(projectId: string, userId: string, fragments: Fragments): Promise<boolean> {
  if (!isValidObjectId(projectId)) return false;
  const result = await Project.updateOne(
    { _id: projectId, userId, ...olderContentThan(new Date(fragments.updatedAt)) },
    { $set: contentUpdate(fragments) },
    { timestamps: false },
  );
  if (result.matchedCount === 0 && !(await Project.exists({ _id: projectId, userId }))) return false;
  writtenThrough.set(projectId, { userId, at: fragments.updatedAt });
  return true;
}

// Deletes the buffer only if it is no newer than the write-through (a save made right after
// Redis recovered is kept), and always drops the cached copies.
const DROP_STALE = `
local edited = redis.call('HGET', KEYS[1], 'updatedAt')
if (not edited) or edited <= ARGV[1] then
  redis.call('DEL', KEYS[1])
  redis.call('SREM', KEYS[2], ARGV[2])
end
redis.call('DEL', KEYS[3], KEYS[4])
return 1`;

/** Drops Redis copies of projects written through MongoDB during an outage. */
export async function dropStaleRedisCopies(): Promise<void> {
  for (const [projectId, { userId, at }] of writtenThrough) {
    await redis.eval(
      DROP_STALE,
      4,
      `project:buffer:${projectId}`,
      'dirty_projects',
      `project:${projectId}`,
      `user:projects:${userId}`,
      at,
      projectId,
    );
    writtenThrough.delete(projectId);
  }
}

redis.on('ready', () => {
  if (writtenThrough.size === 0) return;
  logger.info(`Redis is back: dropping stale copies of ${writtenThrough.size} project(s) saved to MongoDB meanwhile`);
  dropStaleRedisCopies().catch((err) => logger.error(`Dropping stale Redis copies failed: ${err.message}`));
});
