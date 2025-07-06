import { createKeyv } from "@keyv/redis";
import { createCache } from "cache-manager";
import { Redis } from "ioredis";
import { Keyv } from "keyv";
import { Service } from "typedi";
import { config } from "../config/env";
import { RedisConfig } from "../config/redis";
export interface ICacheOptions {
  ttl?: number;
  prefix?: string;
}

export interface ICacheService {
  set(key: string, value: object, ttl?: number): Promise<void>;
  get<T = object>(key: string): Promise<T | null>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  expire(key: string, ttl: number): Promise<void>;
  ttl(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  clearByPattern(pattern: string): Promise<number>;
  mset(keyValuePairs: Record<string, object>): Promise<void>;
  mget<T = object>(keys: string[]): Promise<(T | null)[]>;
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  cache<T>(
    key: string,
    fn: () => Promise<T>,
    options?: ICacheOptions,
  ): Promise<T>;
  invalidateCache(key: string, prefix?: string): Promise<void>;
  invalidateCachePattern(pattern: string, prefix?: string): Promise<number>;
  disconnect(): Promise<void>;
  getHealthStatus(): { redis: boolean; memory: boolean };
  // Redis-specific operations
  hset(key: string, field: string, value: object): Promise<number>;
  hget<T = object>(key: string, field: string): Promise<T | null>;
  hdel(key: string, field: string): Promise<number>;
  hgetall<T = object>(key: string): Promise<Record<string, T>>;
  lpush(key: string, ...values: object[]): Promise<number>;
  rpush(key: string, ...values: object[]): Promise<number>;
  lpop<T = object>(key: string): Promise<T | null>;
  rpop<T = object>(key: string): Promise<T | null>;
  llen(key: string): Promise<number>;
  // Advanced operations
  incrWithExpire(key: string, ttl: number): Promise<number>;
  getRedisClient(): Redis | null;
}

@Service()
export class CacheService implements ICacheService {
  private cacheManager: ReturnType<typeof createCache>;
  private isRedisAvailable = false;
  private memoryStore: Keyv;
  private redisStore: Keyv | null = null;
  private redisClient: Redis | null = null;
  private defaultTTL = 300; // 5 minutes
  private initialized = false;

  constructor() {
    // Initialize memory store immediately
    this.memoryStore = new Keyv({
      ttl: this.defaultTTL * 1000,
    });

    // Set up basic cache manager with memory only initially
    this.cacheManager = createCache({
      stores: [this.memoryStore],
      ttl: this.defaultTTL * 1000,
    });

    // Try to setup Redis synchronously
    this.setupRedisStore();
    this.initialized = true;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      // Wait a bit for initialization to complete
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private setupRedisStore(): void {
    try {
      // Set up both keyv store and raw Redis client
      this.redisStore = createKeyv(config.redis.url);
      this.redisClient = RedisConfig.getClient();
      this.isRedisAvailable = true;

      // Update cache manager to include Redis
      this.setupCacheManager();

      console.log("✅ Cache service initialized (Redis + Memory)");
    } catch (error) {
      this.isRedisAvailable = false;
      this.redisClient = null;
      console.warn(
        "⚠️  Redis is not available - falling back to in-memory cache only",
      );
      console.warn(
        "Redis error:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  private setupCacheManager(): void {
    const stores = [this.memoryStore];

    if (this.isRedisAvailable && this.redisStore) {
      stores.push(this.redisStore);
    }

    this.cacheManager = createCache({
      stores,
      ttl: this.defaultTTL * 1000,
    });
  }

  async set(key: string, value: object, ttl?: number): Promise<void> {
    try {
      await this.ensureInitialized();
      await this.cacheManager.set(key, value, ttl ? ttl * 1000 : undefined);
    } catch (error) {
      console.warn(`Cache set failed for key ${key}:`, error);
    }
  }

  async get<T = object>(key: string): Promise<T | null> {
    try {
      await this.ensureInitialized();
      const value = await this.cacheManager.get(key);
      return (value as T) || null;
    } catch (error) {
      console.warn(`Cache get failed for key ${key}:`, error);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
    } catch (error) {
      console.warn(`Cache delete failed for key ${key}:`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const value = await this.cacheManager.get(key);
      return value !== undefined;
    } catch (error) {
      console.warn(`Cache exists check failed for key ${key}:`, error);
      return false;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      const value = await this.cacheManager.get(key);
      if (value !== undefined) {
        await this.cacheManager.set(key, value, ttl * 1000);
      }
    } catch (error) {
      console.warn(`Cache expire failed for key ${key}:`, error);
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      if (this.isRedisAvailable && this.redisStore) {
        // TTL functionality is limited with keyv, returning -1 as not implemented
        return -1;
      }
      return -1;
    } catch (error) {
      console.warn(`Cache TTL check failed for key ${key}:`, error);
      return -1;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      if (this.isRedisAvailable && this.redisStore) {
        // Pattern matching not available with keyv, would need to implement manually
        console.warn(
          `Pattern matching not supported with keyv for pattern ${pattern}`,
        );
        return [];
      }
      return [];
    } catch (error) {
      console.warn(`Cache keys search failed for pattern ${pattern}:`, error);
      return [];
    }
  }

  async clearByPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      for (const key of keys) {
        await this.del(key);
      }
      return keys.length;
    } catch (error) {
      console.warn(
        `Cache clear by pattern failed for pattern ${pattern}:`,
        error,
      );
      return 0;
    }
  }

  async mset(keyValuePairs: Record<string, object>): Promise<void> {
    try {
      await this.cacheManager.mset(
        Object.entries(keyValuePairs).map(([key, value]) => ({ key, value })),
      );
    } catch (error) {
      console.warn("Cache mset failed:", error);
    }
  }

  async mget<T = object>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values: (T | undefined)[] = await this.cacheManager.mget(keys);
      return values.map((value: T | undefined) => value || null);
    } catch (error) {
      console.warn("Cache mget failed:", error);
      return keys.map(() => null);
    }
  }

  async incr(key: string): Promise<number> {
    try {
      const current = await this.get<number>(key);
      const newValue = (current || 0) + 1;
      await this.set(key, newValue as unknown as object);
      return newValue;
    } catch (error) {
      console.warn(`Cache incr failed for key ${key}:`, error);
      return 0;
    }
  }

  async decr(key: string): Promise<number> {
    try {
      const current = await this.get<number>(key);
      const newValue = (current || 0) - 1;
      await this.set(key, newValue as unknown as object);
      return newValue;
    } catch (error) {
      console.warn(`Cache decr failed for key ${key}:`, error);
      return 0;
    }
  }

  async cache<T>(
    key: string,
    fn: () => Promise<T>,
    options: ICacheOptions = {},
  ): Promise<T> {
    const { ttl = this.defaultTTL, prefix = "cache:" } = options;
    const cacheKey = `${prefix}${key}`;

    try {
      return await this.cacheManager.wrap(cacheKey, fn, ttl * 1000);
    } catch (error) {
      console.warn(`Cache wrap failed for key ${cacheKey}:`, error);
      return await fn();
    }
  }

  async invalidateCache(key: string, prefix = "cache:"): Promise<void> {
    const cacheKey = `${prefix}${key}`;
    await this.del(cacheKey);
  }

  async invalidateCachePattern(
    pattern: string,
    prefix = "cache:",
  ): Promise<number> {
    const cachePattern = `${prefix}${pattern}`;
    return await this.clearByPattern(cachePattern);
  }

  async disconnect(): Promise<void> {
    try {
      if (this.redisStore) {
        await this.redisStore.disconnect();
      }
      if (this.memoryStore) {
        await this.memoryStore.disconnect();
      }
    } catch (error) {
      console.warn("Cache disconnect failed:", error);
    }
  }

  getHealthStatus(): { redis: boolean; memory: boolean } {
    return {
      redis: this.isRedisAvailable,
      memory: true,
    };
  }

  /**
   * Hash operations (Redis-specific, fallback to simple cache)
   */
  async hset(key: string, field: string, value: object): Promise<number> {
    try {
      if (this.isRedisAvailable && this.redisStore) {
        // For Redis store, we need to access the underlying Redis client
        // This is a limitation of the current keyv abstraction
        const hashKey = `${key}:${field}`;
        await this.set(hashKey, value);
        return 1;
      } else {
        const hashKey = `${key}:${field}`;
        await this.set(hashKey, value);
        return 1;
      }
    } catch (error) {
      console.warn(`Hash set failed for key ${key}:${field}:`, error);
      return 0;
    }
  }

  async hget<T = object>(key: string, field: string): Promise<T | null> {
    try {
      const hashKey = `${key}:${field}`;
      return await this.get<T>(hashKey);
    } catch (error) {
      console.warn(`Hash get failed for key ${key}:${field}:`, error);
      return null;
    }
  }

  async hdel(key: string, field: string): Promise<number> {
    try {
      const hashKey = `${key}:${field}`;
      await this.del(hashKey);
      return 1;
    } catch (error) {
      console.warn(`Hash del failed for key ${key}:${field}:`, error);
      return 0;
    }
  }

  async hgetall<T = object>(key: string): Promise<Record<string, T>> {
    try {
      // This is a simplified implementation - in a full Redis implementation
      // we would scan for all keys matching the pattern key:*
      console.warn(
        `Hash getall not fully supported in current implementation for key ${key}`,
      );
      return {};
    } catch (error) {
      console.warn(`Hash getall failed for key ${key}:`, error);
      return {};
    }
  }

  /**
   * List operations (Redis-specific, limited fallback support)
   */
  async lpush(key: string, ...values: object[]): Promise<number> {
    void values; // Acknowledge unused parameter
    try {
      console.warn(
        `List operations not fully supported in current implementation for key ${key}`,
      );
      return 0;
    } catch (error) {
      console.warn(`List lpush failed for key ${key}:`, error);
      return 0;
    }
  }

  async rpush(key: string, ...values: object[]): Promise<number> {
    void values; // Acknowledge unused parameter
    try {
      console.warn(
        `List operations not fully supported in current implementation for key ${key}`,
      );
      return 0;
    } catch (error) {
      console.warn(`List rpush failed for key ${key}:`, error);
      return 0;
    }
  }

  async lpop<T = object>(key: string): Promise<T | null> {
    try {
      console.warn(
        `List operations not fully supported in current implementation for key ${key}`,
      );
      return null;
    } catch (error) {
      console.warn(`List lpop failed for key ${key}:`, error);
      return null;
    }
  }

  async rpop<T = object>(key: string): Promise<T | null> {
    try {
      console.warn(
        `List operations not fully supported in current implementation for key ${key}`,
      );
      return null;
    } catch (error) {
      console.warn(`List rpop failed for key ${key}:`, error);
      return null;
    }
  }

  async llen(key: string): Promise<number> {
    try {
      console.warn(
        `List operations not fully supported in current implementation for key ${key}`,
      );
      return 0;
    } catch (error) {
      console.warn(`List llen failed for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Advanced operations
   */

  /**
   * Atomic increment with expiration - uses Redis pipeline when available
   */
  async incrWithExpire(key: string, ttl: number): Promise<number> {
    try {
      if (this.isRedisAvailable && this.redisClient) {
        // Use Redis pipeline for atomic operation
        const pipeline = this.redisClient.multi();
        pipeline.incr(key);
        pipeline.expire(key, ttl);
        const results = await pipeline.exec();
        return (results?.[0]?.[1] as number) || 0;
      } else {
        // Fallback to separate operations
        const result = await this.incr(key);
        await this.expire(key, ttl);
        return result;
      }
    } catch (error) {
      console.warn(`Atomic incr with expire failed for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get raw Redis client for advanced operations (use sparingly)
   */
  getRedisClient(): Redis | null {
    return this.redisClient;
  }
}
