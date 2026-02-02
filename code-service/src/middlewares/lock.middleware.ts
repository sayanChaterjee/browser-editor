import { Request, Response, NextFunction } from 'express';
import redis from '../config/redis';
import logger from '../config/logger';

/**
 * Prevents multiple users/sessions from overwriting the same project concurrently.
 */
export const conflictLock = async (req: Request, res: Response, next: NextFunction) => {
    const { projectId, name } = req.body;
    const userId = req.userId;

    // Create a unique key for the project lock
    const lockKey = projectId ? `lock:project:${projectId}` : `lock:user:${userId}:name:${name}`;

    try {
        // Attempt to acquire lock for 15 seconds
        const acquired = await redis.set(lockKey, 'locked', 'EX', 15, 'NX');

        if (!acquired) {
            logger.warn(`Conflict detected: Project ${lockKey} is currently being saved by another session.`);
            return res.status(409).json({
                message: 'Conflict: This project is currently being updated in another session. Please wait.'
            });
        }

        // Attach release function to response to ensure lock is cleared
        const releaseLock = async () => {
            await redis.del(lockKey);
        };

        res.on('finish', releaseLock);
        res.on('close', releaseLock);

        next();
    } catch (error) {
        logger.error('Locking middleware failed:', error);
        next(); // Fallback to allowing save if redis fails
    }
};
