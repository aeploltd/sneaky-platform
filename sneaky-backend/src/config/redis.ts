import { createClient } from 'redis';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';

export const redisClient = createClient({
  url: config.redis.url
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('✅ Redis connected successfully');
});

redisClient.on('disconnect', () => {
  logger.warn('Redis disconnected');
});

export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    throw error;
  }
};

export const disconnectRedis = async (): Promise<void> => {
  try {
    await redisClient.disconnect();
    logger.info('Redis disconnected');
  } catch (error) {
    logger.error('Error disconnecting from Redis:', error);
  }
};

// Cache utilities
export class CacheService {
  static async get(key: string): Promise<string | null> {
    try {
      return await redisClient.get(key);
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  static async set(key: string, value: string, ttl: number = 3600): Promise<void> {
    try {
      await redisClient.setEx(key, ttl, value);
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  static async del(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await disconnectRedis();
});