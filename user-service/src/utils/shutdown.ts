import { Server } from 'http';
import mongoose from 'mongoose';
import redis from '../config/redis';
import logger from '../config/logger';
import { disconnectConsumer } from '../events/consumer';

export const setupGracefulShutdown = (server: Server) => {
    const shutdown = async (signal: string) => {
        logger.info(`Received ${signal}. Starting graceful shutdown...`);

        try {
            // 1. Stop accepting new requests
            await new Promise<void>((resolve) => {
                server.close((err) => {
                    if (err) {
                        logger.error('Error closing server:', err);
                    } else {
                        logger.info('HTTP server closed');
                    }
                    resolve();
                });
            });

            // 2. Disconnect from Kafka
            await disconnectConsumer();

            // 3. Disconnect from Redis
            await redis.quit();
            logger.info('Redis disconnected');

            // 4. Disconnect from MongoDB
            await mongoose.connection.close();
            logger.info('MongoDB connection closed');

            logger.info('Graceful shutdown completed');
            process.exit(0);
        } catch (error) {
            logger.error('Error during shutdown:', error);
            process.exit(1);
        }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception:', error);
        shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        shutdown('unhandledRejection');
    });
};
