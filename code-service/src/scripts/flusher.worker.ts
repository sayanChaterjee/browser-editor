import cron from 'node-cron';
import Project from '../models/project.model';
import redis from '../config/redis';
import logger from '../config/logger';
import { flusherDuration, flusherProjectsFlushed, flusherRuns } from '../config/metrics';

export const startFlusherWorker = () => {
    // Run every 60 seconds
    cron.schedule('*/1 * * * *', async () => {
        const dirtyKey = 'dirty_projects';
        const endTimer = flusherDuration.startTimer();
        let result = 'success';

        try {
            // Get all dirty project IDs
            const projectIds = await redis.smembers(dirtyKey);
            if (projectIds.length === 0) return;

            logger.info(`Flusher: Found ${projectIds.length} dirty projects to sync to MongoDB.`);

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
                    logger.debug(`Flusher: Synced fragments for project ${projectId} to MongoDB.`);
                }

                // Remove from dirty set once synced, or when the buffer has expired (nothing
                // left to write) so the project doesn't stay marked dirty forever
                await redis.srem(dirtyKey, projectId);
            }

            logger.info('Flusher: Successfully finished sync cycle.');
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
