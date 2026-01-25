import cron from 'node-cron';
import Project from '../models/project.model';
import redis from '../config/redis';
import logger from '../config/logger';

export const startFlusherWorker = () => {
    // Run every 60 seconds
    cron.schedule('*/1 * * * *', async () => {
        const dirtyKey = 'dirty_projects';

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

                    // Remove from dirty set once synced
                    await redis.srem(dirtyKey, projectId);
                    logger.debug(`Flusher: Synced fragments for project ${projectId} to MongoDB.`);
                }
            }

            logger.info('Flusher: Successfully finished sync cycle.');
        } catch (error) {
            logger.error('Flusher Worker failed:', error);
        }
    });

    logger.info('Flusher worker scheduled (Every 60 seconds)');
};
