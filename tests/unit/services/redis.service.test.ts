import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Container } from "typedi";
import Redis from "ioredis";
import { RedisService } from "../../../src/services/redis.service";
import { RedisConfig } from "../../../src/config/redis";

// Mock Redis
vi.mock("ioredis");
const MockedRedis = vi.mocked(Redis);

// Mock RedisConfig
vi.mock("../../../src/config/redis", () => ({
  RedisConfig: {
    getClient: vi.fn(),
    disconnect: vi.fn(),
  },
}));

describe("RedisService", () => {
  let redisService: RedisService;
  let mockRedisClient: any;

  beforeEach(() => {
    // Create a mock Redis client
    mockRedisClient = {
      set: vi.fn(),
      setex: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
      exists: vi.fn(),
      expire: vi.fn(),
      ttl: vi.fn(),
      keys: vi.fn(),
      mset: vi.fn(),
      mget: vi.fn(),
      incr: vi.fn(),
      decr: vi.fn(),
      hset: vi.fn(),
      hget: vi.fn(),
      hdel: vi.fn(),
      hgetall: vi.fn(),
      lpush: vi.fn(),
      rpush: vi.fn(),
      lpop: vi.fn(),
      rpop: vi.fn(),
      llen: vi.fn(),
    };

    // Mock RedisConfig.getClient to return our mock
    vi.mocked(RedisConfig.getClient).mockReturnValue(mockRedisClient);

    // Clear container and create service
    Container.reset();
    redisService = Container.get(RedisService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    Container.reset();
  });

  describe("Basic operations", () => {
    it("should set a value with TTL", async () => {
      const key = "test-key";
      const value = { test: "data" };
      const ttl = 300;

      mockRedisClient.setex.mockResolvedValue("OK");

      await redisService.set(key, value, ttl);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        key,
        ttl,
        JSON.stringify(value)
      );
    });

    it("should set a value without TTL", async () => {
      const key = "test-key";
      const value = { test: "data" };

      mockRedisClient.set.mockResolvedValue("OK");

      await redisService.set(key, value);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        key,
        JSON.stringify(value)
      );
    });

    it("should get a value and parse JSON", async () => {
      const key = "test-key";
      const value = { test: "data" };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(value));

      const result = await redisService.get(key);

      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(result).toEqual(value);
    });

    it("should return null for non-existent key", async () => {
      const key = "non-existent";

      mockRedisClient.get.mockResolvedValue(null);

      const result = await redisService.get(key);

      expect(result).toBeNull();
    });

    it("should return raw value if JSON parsing fails", async () => {
      const key = "test-key";
      const rawValue = "simple-string";

      mockRedisClient.get.mockResolvedValue(rawValue);

      const result = await redisService.get(key);

      expect(result).toBe(rawValue);
    });

    it("should delete a key", async () => {
      const key = "test-key";

      mockRedisClient.del.mockResolvedValue(1);

      const result = await redisService.del(key);

      expect(mockRedisClient.del).toHaveBeenCalledWith(key);
      expect(result).toBe(1);
    });

    it("should check if key exists", async () => {
      const key = "test-key";

      mockRedisClient.exists.mockResolvedValue(1);

      const result = await redisService.exists(key);

      expect(mockRedisClient.exists).toHaveBeenCalledWith(key);
      expect(result).toBe(true);
    });
  });

  describe("Cache operations", () => {
    it("should cache result of function call", async () => {
      const key = "cache-key";
      const expectedResult = { data: "test" };
      const mockFn = vi.fn().mockResolvedValue(expectedResult);

      mockRedisClient.get.mockResolvedValue(null); // Cache miss
      mockRedisClient.setex.mockResolvedValue("OK");

      const result = await redisService.cache(key, mockFn);

      expect(mockRedisClient.get).toHaveBeenCalledWith("cache:cache-key");
      expect(mockFn).toHaveBeenCalled();
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        "cache:cache-key",
        300,
        JSON.stringify(expectedResult)
      );
      expect(result).toEqual(expectedResult);
    });

    it("should return cached result without calling function", async () => {
      const key = "cache-key";
      const cachedResult = { data: "cached" };
      const mockFn = vi.fn();

      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await redisService.cache(key, mockFn);

      expect(mockRedisClient.get).toHaveBeenCalledWith("cache:cache-key");
      expect(mockFn).not.toHaveBeenCalled();
      expect(result).toEqual(cachedResult);
    });

    it("should use custom cache options", async () => {
      const key = "cache-key";
      const expectedResult = { data: "test" };
      const mockFn = vi.fn().mockResolvedValue(expectedResult);
      const options = { ttl: 600, prefix: "custom:" };

      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setex.mockResolvedValue("OK");

      await redisService.cache(key, mockFn, options);

      expect(mockRedisClient.get).toHaveBeenCalledWith("custom:cache-key");
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        "custom:cache-key",
        600,
        JSON.stringify(expectedResult)
      );
    });

    it("should invalidate cache", async () => {
      const key = "cache-key";

      mockRedisClient.del.mockResolvedValue(1);

      const result = await redisService.invalidateCache(key);

      expect(mockRedisClient.del).toHaveBeenCalledWith("cache:cache-key");
      expect(result).toBe(1);
    });

    it("should invalidate cache by pattern", async () => {
      const pattern = "user:*";
      const keys = ["cache:user:1", "cache:user:2"];

      mockRedisClient.keys.mockResolvedValue(keys);
      mockRedisClient.del.mockResolvedValue(2);

      const result = await redisService.invalidateCachePattern(pattern);

      expect(mockRedisClient.keys).toHaveBeenCalledWith("cache:user:*");
      expect(mockRedisClient.del).toHaveBeenCalledWith(...keys);
      expect(result).toBe(2);
    });
  });

  describe("Hash operations", () => {
    it("should set hash field", async () => {
      const key = "hash-key";
      const field = "field1";
      const value = { data: "test" };

      mockRedisClient.hset.mockResolvedValue(1);

      const result = await redisService.hset(key, field, value);

      expect(mockRedisClient.hset).toHaveBeenCalledWith(
        key,
        field,
        JSON.stringify(value)
      );
      expect(result).toBe(1);
    });

    it("should get hash field", async () => {
      const key = "hash-key";
      const field = "field1";
      const value = { data: "test" };

      mockRedisClient.hget.mockResolvedValue(JSON.stringify(value));

      const result = await redisService.hget(key, field);

      expect(mockRedisClient.hget).toHaveBeenCalledWith(key, field);
      expect(result).toEqual(value);
    });

    it("should get all hash fields", async () => {
      const key = "hash-key";
      const hashData = {
        field1: JSON.stringify({ data: "test1" }),
        field2: JSON.stringify({ data: "test2" }),
      };

      mockRedisClient.hgetall.mockResolvedValue(hashData);

      const result = await redisService.hgetall(key);

      expect(mockRedisClient.hgetall).toHaveBeenCalledWith(key);
      expect(result).toEqual({
        field1: { data: "test1" },
        field2: { data: "test2" },
      });
    });
  });

  describe("List operations", () => {
    it("should push to left of list", async () => {
      const key = "list-key";
      const values = [{ data: "test1" }, { data: "test2" }];

      mockRedisClient.lpush.mockResolvedValue(2);

      const result = await redisService.lpush(key, ...values);

      expect(mockRedisClient.lpush).toHaveBeenCalledWith(
        key,
        JSON.stringify(values[0]),
        JSON.stringify(values[1])
      );
      expect(result).toBe(2);
    });

    it("should pop from left of list", async () => {
      const key = "list-key";
      const value = { data: "test" };

      mockRedisClient.lpop.mockResolvedValue(JSON.stringify(value));

      const result = await redisService.lpop(key);

      expect(mockRedisClient.lpop).toHaveBeenCalledWith(key);
      expect(result).toEqual(value);
    });

    it("should get list length", async () => {
      const key = "list-key";

      mockRedisClient.llen.mockResolvedValue(5);

      const result = await redisService.llen(key);

      expect(mockRedisClient.llen).toHaveBeenCalledWith(key);
      expect(result).toBe(5);
    });
  });

  describe("Utility methods", () => {
    it("should get Redis client", () => {
      const client = redisService.getClient();
      expect(client).toBe(mockRedisClient);
    });

    it("should disconnect from Redis", async () => {
      await redisService.disconnect();
      expect(RedisConfig.disconnect).toHaveBeenCalled();
    });
  });
});
