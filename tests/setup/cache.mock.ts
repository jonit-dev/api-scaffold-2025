import { vi } from "vitest";
import { ICacheService } from "../../src/services/cache.service";

let mockCacheData: Map<string, any> = new Map();

export const createCacheMock = (): ICacheService => {
  return {
    set: vi
      .fn()
      .mockImplementation(async (key: string, value: any, ttl?: number) => {
        mockCacheData.set(key, value);
      }),

    get: vi
      .fn()
      .mockImplementation(async <T>(key: string): Promise<T | null> => {
        return mockCacheData.get(key) || null;
      }),

    del: vi.fn().mockImplementation(async (key: string) => {
      mockCacheData.delete(key);
    }),

    exists: vi
      .fn()
      .mockImplementation(async (key: string): Promise<boolean> => {
        return mockCacheData.has(key);
      }),

    expire: vi.fn().mockImplementation(async (key: string, ttl: number) => {
      // TTL implementation is simplified for tests
    }),

    ttl: vi.fn().mockImplementation(async (key: string): Promise<number> => {
      return mockCacheData.has(key) ? 300 : -1;
    }),

    keys: vi
      .fn()
      .mockImplementation(async (pattern: string): Promise<string[]> => {
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        return Array.from(mockCacheData.keys()).filter((key) =>
          regex.test(key),
        );
      }),

    clearByPattern: vi
      .fn()
      .mockImplementation(async (pattern: string): Promise<number> => {
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        const matchingKeys = Array.from(mockCacheData.keys()).filter((key) =>
          regex.test(key),
        );
        matchingKeys.forEach((key) => mockCacheData.delete(key));
        return matchingKeys.length;
      }),

    mset: vi
      .fn()
      .mockImplementation(async (keyValuePairs: Record<string, any>) => {
        Object.entries(keyValuePairs).forEach(([key, value]) => {
          mockCacheData.set(key, value);
        });
      }),

    mget: vi
      .fn()
      .mockImplementation(async <T>(keys: string[]): Promise<(T | null)[]> => {
        return keys.map((key) => mockCacheData.get(key) || null);
      }),

    incr: vi.fn().mockImplementation(async (key: string): Promise<number> => {
      const current = mockCacheData.get(key) || 0;
      const newValue = current + 1;
      mockCacheData.set(key, newValue);
      return newValue;
    }),

    decr: vi.fn().mockImplementation(async (key: string): Promise<number> => {
      const current = mockCacheData.get(key) || 0;
      const newValue = current - 1;
      mockCacheData.set(key, newValue);
      return newValue;
    }),

    cache: vi
      .fn()
      .mockImplementation(
        async <T>(
          key: string,
          fn: () => Promise<T>,
          options?: any,
        ): Promise<T> => {
          const cacheKey = `${options?.prefix || "cache:"}${key}`;
          const cached = mockCacheData.get(cacheKey);
          if (cached !== undefined) {
            return cached;
          }
          const result = await fn();
          mockCacheData.set(cacheKey, result);
          return result;
        },
      ),

    invalidateCache: vi
      .fn()
      .mockImplementation(async (key: string, prefix = "cache:") => {
        const cacheKey = `${prefix}${key}`;
        mockCacheData.delete(cacheKey);
      }),

    invalidateCachePattern: vi
      .fn()
      .mockImplementation(
        async (pattern: string, prefix = "cache:"): Promise<number> => {
          const cachePattern = `${prefix}${pattern}`;
          const regex = new RegExp(cachePattern.replace(/\*/g, ".*"));
          const matchingKeys = Array.from(mockCacheData.keys()).filter((key) =>
            regex.test(key),
          );
          matchingKeys.forEach((key) => mockCacheData.delete(key));
          return matchingKeys.length;
        },
      ),

    disconnect: vi.fn().mockResolvedValue(undefined),

    getHealthStatus: vi.fn().mockReturnValue({ redis: true, memory: true }),

    // Hash operations
    hset: vi
      .fn()
      .mockImplementation(
        async (key: string, field: string, value: any): Promise<number> => {
          const hashKey = `${key}:${field}`;
          mockCacheData.set(hashKey, value);
          return 1;
        },
      ),

    hget: vi
      .fn()
      .mockImplementation(
        async <T>(key: string, field: string): Promise<T | null> => {
          const hashKey = `${key}:${field}`;
          return mockCacheData.get(hashKey) || null;
        },
      ),

    hdel: vi
      .fn()
      .mockImplementation(
        async (key: string, field: string): Promise<number> => {
          const hashKey = `${key}:${field}`;
          const existed = mockCacheData.has(hashKey);
          mockCacheData.delete(hashKey);
          return existed ? 1 : 0;
        },
      ),

    hgetall: vi
      .fn()
      .mockImplementation(
        async <T>(key: string): Promise<Record<string, T>> => {
          // Simplified implementation - returns empty object
          return {};
        },
      ),

    // List operations
    lpush: vi
      .fn()
      .mockImplementation(
        async (key: string, ...values: any[]): Promise<number> => {
          // Simplified implementation - returns 0 since lists are not fully supported
          return 0;
        },
      ),

    rpush: vi
      .fn()
      .mockImplementation(
        async (key: string, ...values: any[]): Promise<number> => {
          // Simplified implementation - returns 0 since lists are not fully supported
          return 0;
        },
      ),

    lpop: vi
      .fn()
      .mockImplementation(async <T>(key: string): Promise<T | null> => {
        // Simplified implementation - returns null since lists are not fully supported
        return null;
      }),

    rpop: vi
      .fn()
      .mockImplementation(async <T>(key: string): Promise<T | null> => {
        // Simplified implementation - returns null since lists are not fully supported
        return null;
      }),

    llen: vi.fn().mockImplementation(async (key: string): Promise<number> => {
      // Simplified implementation - returns 0 since lists are not fully supported
      return 0;
    }),

    // Advanced operations
    incrWithExpire: vi
      .fn()
      .mockImplementation(async (key: string, ttl: number): Promise<number> => {
        const current = mockCacheData.get(key) || 0;
        const newValue = current + 1;
        mockCacheData.set(key, newValue);
        // TTL is simplified for tests
        return newValue;
      }),

    getRedisClient: vi.fn().mockReturnValue(null),
  };
};

export const resetCacheMock = () => {
  mockCacheData.clear();
};

export const getCacheMockData = () => {
  return new Map(mockCacheData);
};

// Create singleton mock instance
let mockCacheService: ICacheService;

export const getCacheMockInstance = (): ICacheService => {
  if (!mockCacheService) {
    mockCacheService = createCacheMock();
  }
  return mockCacheService;
};

// Mock the CacheService
vi.mock("../../src/services/cache.service", () => ({
  CacheService: vi.fn().mockImplementation(() => getCacheMockInstance()),
  ICacheService: {},
}));
