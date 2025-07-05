import { Container } from "typedi";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RedisService } from "../redis.service";
import { getRedisMockInstance } from "../../../tests/setup/redis.mock";

describe("RedisService", () => {
  let redisService: RedisService;
  let mockRedisClient: any;

  beforeEach(() => {
    // Get the centralized mock instance
    mockRedisClient = getRedisMockInstance();

    // Ensure the mock is connected
    if (mockRedisClient && mockRedisClient.connect) {
      mockRedisClient.connect();
    }

    // Create service
    redisService = Container.get(RedisService);
  });

  afterEach(() => {
    // Test cleanup is handled by global setup
  });

  describe("Basic operations", () => {
    it("should set a value with TTL", async () => {
      const key = "test-key";
      const value = { test: "data" };
      const ttl = 300;

      const result = await redisService.set(key, value, ttl);

      expect(result).toBe("OK");

      // Verify the value was set
      const stored = await redisService.get(key);
      expect(stored).toEqual(value);
    });

    it("should set a value without TTL", async () => {
      const key = "test-key";
      const value = { test: "data" };

      const result = await redisService.set(key, value);

      expect(result).toBe("OK");

      // Verify the value was set
      const stored = await redisService.get(key);
      expect(stored).toEqual(value);
    });

    it("should get a value and parse JSON", async () => {
      const key = "test-key";
      const value = { test: "data" };

      await redisService.set(key, value);
      const result = await redisService.get(key);

      expect(result).toEqual(value);
    });

    it("should return null for non-existent key", async () => {
      const key = "non-existent";

      const result = await redisService.get(key);

      expect(result).toBeNull();
    });

    it("should return raw value if JSON parsing fails", async () => {
      const key = "test-key";
      const rawValue = "simple-string";

      // Set a raw string value directly
      await mockRedisClient.set(key, rawValue);

      const result = await redisService.get(key);

      expect(result).toBe(rawValue);
    });

    it("should delete a key", async () => {
      const key = "test-key";
      const value = { test: "data" };

      await redisService.set(key, value);
      const result = await redisService.del(key);

      expect(result).toBe(1);

      // Verify the key was deleted
      const stored = await redisService.get(key);
      expect(stored).toBeNull();
    });

    it("should check if key exists", async () => {
      const key = "test-key";
      const value = { test: "data" };

      await redisService.set(key, value);
      const result = await redisService.exists(key);

      expect(result).toBe(true);

      // Check non-existent key
      const nonExistentResult = await redisService.exists("non-existent");
      expect(nonExistentResult).toBe(false);
    });
  });

  describe("Cache operations", () => {
    it("should cache result of function call", async () => {
      const key = "cache-key";
      const expectedResult = { data: "test" };
      let callCount = 0;
      const mockFn = async () => {
        callCount++;
        return expectedResult;
      };

      const result = await redisService.cache(key, mockFn);

      expect(callCount).toBe(1);
      expect(result).toEqual(expectedResult);

      // Verify it was cached
      const cached = await redisService.get("cache:cache-key");
      expect(cached).toEqual(expectedResult);
    });

    it("should return cached result without calling function", async () => {
      const key = "cache-key";
      const cachedResult = { data: "cached" };
      let callCount = 0;
      const mockFn = async () => {
        callCount++;
        return { data: "fresh" };
      };

      // Pre-populate cache
      await redisService.set("cache:cache-key", cachedResult);

      const result = await redisService.cache(key, mockFn);

      expect(callCount).toBe(0);
      expect(result).toEqual(cachedResult);
    });

    it("should use custom cache options", async () => {
      const key = "cache-key";
      const expectedResult = { data: "test" };
      let callCount = 0;
      const mockFn = async () => {
        callCount++;
        return expectedResult;
      };
      const options = { ttl: 600, prefix: "custom:" };

      await redisService.cache(key, mockFn, options);

      expect(callCount).toBe(1);

      // Verify it was cached with custom prefix
      const cached = await redisService.get("custom:cache-key");
      expect(cached).toEqual(expectedResult);
    });

    it("should invalidate cache", async () => {
      const key = "cache-key";
      const testData = { data: "test" };

      // Set up cache
      await redisService.set("cache:cache-key", testData);

      const result = await redisService.invalidateCache(key);

      expect(result).toBe(1);

      // Verify cache was cleared
      const cached = await redisService.get("cache:cache-key");
      expect(cached).toBeNull();
    });

    it("should invalidate cache by pattern", async () => {
      const pattern = "user:*";

      // Set up multiple cache entries
      await redisService.set("cache:user:1", { id: 1 });
      await redisService.set("cache:user:2", { id: 2 });
      await redisService.set("cache:other:3", { id: 3 });

      const result = await redisService.invalidateCachePattern(pattern);

      expect(result).toBe(2);

      // Verify correct keys were deleted
      expect(await redisService.get("cache:user:1")).toBeNull();
      expect(await redisService.get("cache:user:2")).toBeNull();
      expect(await redisService.get("cache:other:3")).toEqual({ id: 3 });
    });
  });

  describe("Hash operations", () => {
    it("should set hash field", async () => {
      const key = "hash-key";
      const field = "field1";
      const value = { data: "test" };

      const result = await redisService.hset(key, field, value);

      expect(result).toBe(1);

      // Verify the hash field was set
      const stored = await redisService.hget(key, field);
      expect(stored).toEqual(value);
    });

    it("should get hash field", async () => {
      const key = "hash-key";
      const field = "field1";
      const value = { data: "test" };

      await redisService.hset(key, field, value);
      const result = await redisService.hget(key, field);

      expect(result).toEqual(value);
    });

    it("should get all hash fields", async () => {
      const key = "hash-key";
      const data1 = { data: "test1" };
      const data2 = { data: "test2" };

      await redisService.hset(key, "field1", data1);
      await redisService.hset(key, "field2", data2);

      const result = await redisService.hgetall(key);

      expect(result).toEqual({
        field1: data1,
        field2: data2,
      });
    });
  });

  describe("List operations", () => {
    it("should push to left of list", async () => {
      const key = "list-key";
      const values = [{ data: "test1" }, { data: "test2" }];

      const result = await redisService.lpush(key, ...values);

      expect(result).toBe(2);

      // Verify list length
      const length = await redisService.llen(key);
      expect(length).toBe(2);
    });

    it("should pop from left of list", async () => {
      const key = "list-key";
      const value = { data: "test" };

      await redisService.lpush(key, value);
      const result = await redisService.lpop(key);

      expect(result).toEqual(value);
    });

    it("should get list length", async () => {
      const key = "list-key";
      const values = [{ data: "test1" }, { data: "test2" }, { data: "test3" }];

      await redisService.lpush(key, ...values);
      const result = await redisService.llen(key);

      expect(result).toBe(3);
    });
  });

  describe("Utility methods", () => {
    it("should get Redis client", () => {
      const client = redisService.getClient();
      expect(client).toBe(mockRedisClient);
    });

    it("should disconnect from Redis", async () => {
      await redisService.disconnect();
      // Verify disconnect was called (no exception thrown)
      expect(true).toBe(true);
    });
  });
});
