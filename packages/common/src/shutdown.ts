import { Server } from 'http';
import type { Logger } from './logger';

export interface CleanupStep {
  name: string;
  run: () => Promise<unknown>;
}

export interface ShutdownOptions {
  // Steps run in order after the HTTP server stops accepting requests.
  cleanup?: CleanupStep[];
  // The gateway only logs unhandled rejections (transient Redis errors shouldn't kill it).
  exitOnUnhandledRejection?: boolean;
}

export function setupGracefulShutdown(
  server: Server,
  logger: Logger,
  { cleanup = [], exitOnUnhandledRejection = true }: ShutdownOptions = {},
): void {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    await new Promise<void>((resolve) => {
      server.close((err) => {
        if (err) logger.error(`Error closing server: ${err.message}`);
        else logger.info('HTTP server closed');
        resolve();
      });
    });

    let failed = false;
    for (const step of cleanup) {
      try {
        await step.run();
        logger.info(`${step.name} closed`);
      } catch (err) {
        failed = true;
        logger.error(`Error closing ${step.name}: ${(err as Error).message}`);
      }
    }

    logger.info('Graceful shutdown completed');
    process.exit(failed ? 1 : 0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    void shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
    if (exitOnUnhandledRejection) void shutdown('unhandledRejection');
  });
}
