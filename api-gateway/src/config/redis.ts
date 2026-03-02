import Redis from 'ioredis';
import { config } from '.';
import logger from './logger';

// Singleton Redis client
export class RedisClient {
  private static instance: Redis;
  private static isConnected = false;

  private constructor() { }

  public static getInstance(): Redis {
    if (!RedisClient.instance) {
      RedisClient.instance = new Redis(config.REDIS_URL, {
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 5,
        enableOfflineQueue: false,
      });

      RedisClient.setupEventListeners();
    }
    return RedisClient.instance;
  }

  private static setupEventListeners(): void {
    RedisClient.instance.on('connect', () => {
      RedisClient.isConnected = true;
      logger.info('Connected to Redis');
    });

    RedisClient.instance.on('error', (error) => {
      RedisClient.isConnected = false;
      logger.error('Redis connection error:', error);
    });

    RedisClient.instance.on('close', () => {
      RedisClient.isConnected = false;
      logger.warn('Redis connection closed');
    });

    RedisClient.instance.on('reconnecting', () => {
      logger.info('Reconnecting to Redis...');
    });
  }

  public static isReady(): boolean {
    return RedisClient.isConnected;
  }

  public static async disconnect(): Promise<void> {
    if (RedisClient.instance) {
      await RedisClient.instance.quit();
      RedisClient.isConnected = false;
      logger.info('Redis connection closed gracefully');
    }
  }
}

export default RedisClient.getInstance();