import { Service } from "typedi";
import { Redis } from "ioredis";
import { RedisConfig } from "../config/redis";

export interface ICacheOptions {
  ttl?: number;
  prefix?: string;
}

@Service()
export class RedisService {
  private client: Redis;
  private defaultTTL = 300; // 5 minutes

  constructor() {
    this.client = RedisConfig.getClient();
  }

  /**
   * Set a key-value pair in Redis
   */
  async set(key: string, value: object, ttl?: number): Promise<void> {
    const serializedValue = JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, serializedValue);
    } else {
      await this.client.set(key, serializedValue);
    }
  }

  /**
   * Get a value from Redis
   */
  async get<T = object>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (value === null) {
      return null;
    }
    try {
      return JSON.parse(value);
    } catch {
      return value as T;
    }
  }

  /**
   * Delete a key from Redis
   */
  async del(key: string): Promise<number> {
    return await this.client.del(key);
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Set expiration time for a key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    const result = await this.client.expire(key, ttl);
    return result === 1;
  }

  /**
   * Get time to live for a key
   */
  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    return await this.client.keys(pattern);
  }

  /**
   * Clear all keys matching a pattern
   */
  async clearByPattern(pattern: string): Promise<number> {
    const keys = await this.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }
    return await this.client.del(...keys);
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(keyValuePairs: Record<string, object>): Promise<void> {
    const pairs: string[] = [];
    for (const [key, value] of Object.entries(keyValuePairs)) {
      pairs.push(key, JSON.stringify(value));
    }
    await this.client.mset(...pairs);
  }

  /**
   * Get multiple values
   */
  async mget<T = object>(keys: string[]): Promise<(T | null)[]> {
    const values = await this.client.mget(...keys);
    return values.map((value) => {
      if (value === null) {
        return null;
      }
      try {
        return JSON.parse(value);
      } catch {
        return value as T;
      }
    });
  }

  /**
   * Increment a numeric value
   */
  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  /**
   * Decrement a numeric value
   */
  async decr(key: string): Promise<number> {
    return await this.client.decr(key);
  }

  /**
   * Hash operations
   */
  async hset(key: string, field: string, value: object): Promise<number> {
    return await this.client.hset(key, field, JSON.stringify(value));
  }

  async hget<T = object>(key: string, field: string): Promise<T | null> {
    const value = await this.client.hget(key, field);
    if (value === null) {
      return null;
    }
    try {
      return JSON.parse(value);
    } catch {
      return value as T;
    }
  }

  async hdel(key: string, field: string): Promise<number> {
    return await this.client.hdel(key, field);
  }

  async hgetall<T = object>(key: string): Promise<Record<string, T>> {
    const result = await this.client.hgetall(key);
    const parsed: Record<string, T> = {};
    for (const [field, value] of Object.entries(result)) {
      try {
        parsed[field] = JSON.parse(value);
      } catch {
        parsed[field] = value as T;
      }
    }
    return parsed;
  }

  /**
   * List operations
   */
  async lpush(key: string, ...values: object[]): Promise<number> {
    const serializedValues = values.map((value) => JSON.stringify(value));
    return await this.client.lpush(key, ...serializedValues);
  }

  async rpush(key: string, ...values: object[]): Promise<number> {
    const serializedValues = values.map((value) => JSON.stringify(value));
    return await this.client.rpush(key, ...serializedValues);
  }

  async lpop<T = object>(key: string): Promise<T | null> {
    const value = await this.client.lpop(key);
    if (value === null) {
      return null;
    }
    try {
      return JSON.parse(value);
    } catch {
      return value as T;
    }
  }

  async rpop<T = object>(key: string): Promise<T | null> {
    const value = await this.client.rpop(key);
    if (value === null) {
      return null;
    }
    try {
      return JSON.parse(value);
    } catch {
      return value as T;
    }
  }

  async llen(key: string): Promise<number> {
    return await this.client.llen(key);
  }

  /**
   * Cache wrapper methods
   */
  async cache<T>(
    key: string,
    fn: () => Promise<T>,
    options: ICacheOptions = {},
  ): Promise<T> {
    const { ttl = this.defaultTTL, prefix = "cache:" } = options;
    const cacheKey = `${prefix}${key}`;

    const cached = await this.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const result = await fn();
    await this.set(cacheKey, result as object, ttl);
    return result;
  }

  async invalidateCache(key: string, prefix = "cache:"): Promise<number> {
    const cacheKey = `${prefix}${key}`;
    return await this.del(cacheKey);
  }

  async invalidateCachePattern(
    pattern: string,
    prefix = "cache:",
  ): Promise<number> {
    const cachePattern = `${prefix}${pattern}`;
    return await this.clearByPattern(cachePattern);
  }

  /**
   * Get Redis client for advanced operations
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await RedisConfig.disconnect();
  }
}
