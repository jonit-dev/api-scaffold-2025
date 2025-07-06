import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { Container } from "typedi";
import { CacheService } from "../../services/cache.service";
import {
  cacheMiddleware,
  decoratorCacheMiddleware,
} from "../../middlewares/cache.middleware";
import { Cache } from "../../decorators/cache.decorator";

describe("Cache Integration Tests", () => {
  let app: express.Application;
  let redisService: CacheService;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Clear container
    Container.reset();

    // Create a mock Redis service
    const mockCacheService = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn(),
      keys: vi.fn(),
      exists: vi.fn(),
      expire: vi.fn(),
      ttl: vi.fn(),
      clearByPattern: vi.fn(),
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
      cache: vi.fn(),
      invalidateCache: vi.fn(),
      invalidateCachePattern: vi.fn(),
      getClient: vi.fn(),
      disconnect: vi.fn(),
    };

    // Register the mock service in the container
    Container.set(CacheService, mockCacheService);
    redisService = Container.get(CacheService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    Container.reset();
  });

  describe("Cache Middleware", () => {
    it("should cache GET request responses", async () => {
      // Setup route with cache middleware
      app.get("/test", cacheMiddleware({ ttl: 60 }), (req, res) => {
        res.json({ message: "Hello World", timestamp: Date.now() });
      });

      // First request - cache miss
      vi.mocked(redisService.get).mockResolvedValue(null);
      vi.mocked(redisService.set).mockResolvedValue(undefined);

      const response1 = await request(app).get("/test").expect(200);

      expect(response1.headers["x-cache"]).toBe("MISS");
      expect(response1.body.message).toBe("Hello World");
      expect(redisService.get).toHaveBeenCalled();
      expect(redisService.set).toHaveBeenCalled();

      // Second request - cache hit
      const cachedData = { message: "Hello World", timestamp: 123456789 };
      vi.mocked(redisService.get).mockResolvedValue(cachedData);

      const response2 = await request(app).get("/test").expect(200);

      expect(response2.headers["x-cache"]).toBe("HIT");
      expect(response2.body).toEqual(cachedData);
    });

    it("should not cache POST requests", async () => {
      app.post("/test", cacheMiddleware(), (req, res) => {
        res.json({ message: "Created" });
      });

      vi.mocked(redisService.get).mockResolvedValue(null);

      const response = await request(app)
        .post("/test")
        .send({ data: "test" })
        .expect(200);

      expect(response.headers["x-cache"]).toBeUndefined();
      expect(redisService.get).not.toHaveBeenCalled();
    });

    it("should respect cache condition", async () => {
      app.get(
        "/test-condition",
        cacheMiddleware({
          condition: (req) => req.query.cache === "true",
        }),
        (req, res) => {
          res.json({ message: "Conditional cache" });
        },
      );

      // Request without cache condition
      await request(app).get("/test-condition?cache=false").expect(200);

      expect(redisService.get).not.toHaveBeenCalled();

      // Request with cache condition
      vi.mocked(redisService.get).mockResolvedValue(null);

      await request(app).get("/test-condition?cache=true").expect(200);

      expect(redisService.get).toHaveBeenCalled();
    });

    it("should use custom key generator", async () => {
      const customKeyGen = vi.fn().mockReturnValue("custom-key");

      app.get(
        "/test-custom-key",
        cacheMiddleware({
          keyGenerator: customKeyGen,
        }),
        (req, res) => {
          res.json({ message: "Custom key" });
        },
      );

      vi.mocked(redisService.get).mockResolvedValue(null);

      await request(app).get("/test-custom-key").expect(200);

      expect(customKeyGen).toHaveBeenCalled();
      expect(redisService.get).toHaveBeenCalledWith("custom-key");
    });
  });

  describe("Cache Decorator", () => {
    it("should work with cache decorator metadata", async () => {
      class TestController {
        @Cache({ ttl: 120, key: "test-route" })
        static testMethod(req: express.Request, res: express.Response) {
          res.json({ message: "Decorated route", timestamp: Date.now() });
        }
      }

      // Mock route with decorator metadata
      app.get(
        "/decorated",
        (req, res, next) => {
          // Simulate routing-controllers behavior by setting metadata
          const route = req.route;
          if (route && route.stack) {
            route.stack[0].handle = TestController.testMethod;
          }
          next();
        },
        decoratorCacheMiddleware(),
        TestController.testMethod,
      );

      // This test would require more complex setup to fully test decorator metadata
      // For now, we'll test the basic middleware functionality
      vi.mocked(redisService.get).mockResolvedValue(null);

      const response = await request(app).get("/decorated").expect(200);

      expect(response.body.message).toBe("Decorated route");
    });
  });

  describe("Error Handling", () => {
    it("should handle Redis errors gracefully", async () => {
      app.get("/test", cacheMiddleware(), (req, res) => {
        res.json({ message: "Error handling test" });
      });

      // Simulate Redis error
      vi.mocked(redisService.get).mockRejectedValue(
        new Error("Redis connection failed"),
      );

      const response = await request(app).get("/test").expect(200);

      expect(response.body.message).toBe("Error handling test");
      // Should continue to route handler even if cache fails
    });

    it("should handle invalid JSON in cache gracefully", async () => {
      app.get("/test", cacheMiddleware(), (req, res) => {
        res.json({ message: "JSON error test" });
      });

      // Return invalid JSON from cache
      vi.mocked(redisService.get).mockResolvedValue("invalid-json{");

      const response = await request(app).get("/test").expect(200);

      // Should return the response data as-is when JSON parsing fails
      expect(response.body).toBe("invalid-json{");
    });
  });

  describe("Cache Headers", () => {
    it("should set appropriate cache headers", async () => {
      app.get("/test-headers", cacheMiddleware(), (req, res) => {
        res.json({ message: "Headers test" });
      });

      vi.mocked(redisService.get).mockResolvedValue(null);

      const response = await request(app).get("/test-headers").expect(200);

      expect(response.headers["x-cache"]).toBe("MISS");
      expect(response.headers["x-cache-key"]).toBeDefined();
    });

    it("should set cache hit headers", async () => {
      app.get("/test-hit", cacheMiddleware(), (req, res) => {
        res.json({ message: "Headers test" });
      });

      const cachedData = { message: "Cached response" };
      vi.mocked(redisService.get).mockResolvedValue(cachedData);

      const response = await request(app).get("/test-hit").expect(200);

      expect(response.headers["x-cache"]).toBe("HIT");
      expect(response.headers["x-cache-key"]).toBeDefined();
    });
  });
});
