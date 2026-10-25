import cron from 'node-cron';
import Project from '../models/project.model';
import redis from '../config/redis';
import logger from '../config/logger';
import { flusherDuration, flusherProjectsFlushed, flusherRuns } from '../config/metrics';

const DIRTY_KEY = 'dirty_projects';

// Clears the dirty mark only if the buffer still holds the version just written. A save
// that lands mid-flush changes updatedAt, so the project stays dirty and the next cycle
// writes it (otherwise that edit would sit in Redis until the buffer expired, then be lost).
const MARK_FLUSHED = `
if redis.call('HGET', KEYS[2], 'updatedAt') == ARGV[2] then
  return redis.call('SREM', KEYS[1], ARGV[1])
end
return 0`;

/**
 * One flush cycle: writes every dirty project's buffered fragments to MongoDB.
 * Returns the number of projects written.
 */
export async function flushDirtyProjects(): Promise<number> {
    const projectIds = await redis.smembers(DIRTY_KEY);
    if (projectIds.length === 0) return 0;

    logger.info(`Flusher: Found ${projectIds.length} dirty projects to sync to MongoDB.`);
    let flushed = 0;

    for (const projectId of projectIds) {
        const bufferKey = `project:buffer:${projectId}`;
        const cachedFragments = await redis.hgetall(bufferKey);

        if (Object.keys(cachedFragments).length > 0) {
            // Sync only the fragments and updatedAt
            const { html, css, js, updatedAt } = cachedFragments;

            await Project.findByIdAndUpdate(projectId, {
                $set: {
                    ...(html !== undefined && { html }),
                    ...(css !== undefined && { css }),
                    ...(js !== undefined && { js }),
                    ...(updatedAt !== undefined && { updatedAt: new Date(updatedAt) })
                }
            });

            flusherProjectsFlushed.inc();
            flushed++;
            logger.debug(`Flusher: Synced fragments for project ${projectId} to MongoDB.`);

            if (updatedAt !== undefined) {
                await redis.eval(MARK_FLUSHED, 2, DIRTY_KEY, bufferKey, projectId, updatedAt);
                continue;
            }
        }

        // Buffer expired (nothing left to write) or carries no version: clear the mark so
        // the project doesn't stay dirty forever
        await redis.srem(DIRTY_KEY, projectId);
    }

    logger.info('Flusher: Successfully finished sync cycle.');
    return flushed;
}

export const startFlusherWorker = () => {
    // Run every 60 seconds
    cron.schedule('*/1 * * * *', async () => {
        const endTimer = flusherDuration.startTimer();
        let result = 'success';

        try {
            await flushDirtyProjects();
        } catch (error) {
            result = 'error';
            logger.error('Flusher Worker failed:', error);
        } finally {
            // Counted on every run, including idle ones, so a stopped flusher is visible
            flusherRuns.inc({ result });
            endTimer();
        }
    });

    logger.info('Flusher worker scheduled (Every 60 seconds)');
};
