import cron from 'node-cron';
import redis from '../config/redis';
import logger from '../config/logger';

export const startAuthJanitor = () => {
    // Run every 24 hours at midnight
    cron.schedule('0 0 * * *', async () => {
        logger.info('Starting Auth Session Janitor...');
        try {
            // Clean up orphaned or expired refresh tokens specifically if they linger
            // Note: Redis handles TTL automatically, but we can do a secondary scan 
            // for any keys that might have been lost due to logic errors if needed.
            // For now, we'll focus on logging and ensuring we don't have excessive keys.

            const refreshKeys = await redis.keys('refresh:*:*');
            logger.info(`Currently tracking ${refreshKeys.length} active refresh sessions.`);

            // Additional cleanup logic could go here if we used a DB to track sessions
        } catch (error) {
            logger.error('Auth Janitor failed:', error);
        }
    });

    logger.info('Auth Janitor worker scheduled (Daily at 00:00)');
};
