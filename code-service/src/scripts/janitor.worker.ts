import cron from 'node-cron';
import Project from '../models/project.model';
import logger from '../config/logger';

export const startCodeJanitor = () => {
    // Run every day at 1 AM
    cron.schedule('0 1 * * *', async () => {
        logger.info('Code Janitor: Starting maintenance cycle...');
        try {
            // 1. Cleanup "Guest" or "Trial" projects older than 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const deleteResult = await Project.deleteMany({
                $or: [
                    { name: { $regex: /guest/i } },
                    { name: { $regex: /trial/i } }
                ],
                updatedAt: { $lt: sevenDaysAgo }
            });

            logger.info(`Code Janitor: Deleted ${deleteResult.deletedCount} old guest/trial projects.`);

            // 2. Future: Cleanup orphaned file assets if file service is added

        } catch (error) {
            logger.error('Code Janitor failed:', error);
        }
    });

    logger.info('Code Janitor scheduled (Daily at 01:00)');
};
