import { JsonController, Get, QueryParam } from "routing-controllers";
import { Service } from "typedi";
import { Cache } from "../decorators/cache.decorator";
import { CacheService } from "../services/cache.service";

@JsonController("/cache-demo")
@Service()
export class CacheDemoController {
  constructor(private cacheService: CacheService) {}

  @Get("/basic")
  @Cache({ ttl: 60, key: "basic-demo" })
  async basicCache(): Promise<object> {
    // Simulate expensive operation
    await new Promise((resolve) => globalThis.setTimeout(resolve, 100));

    return {
      message: "This response is cached for 60 seconds",
      timestamp: new Date().toISOString(),
      cached: false,
    };
  }

  @Get("/dynamic")
  @Cache({
    ttl: 300,
    keyGenerator: (req) => `dynamic-${req.query?.id || "no-id"}`,
    condition: (req) => !!req.query?.id,
  })
  async dynamicCache(
    @QueryParam("id", { required: false }) id?: string,
  ): Promise<object> {
    if (!id) {
      return {
        message: "No caching without ID parameter",
        timestamp: new Date().toISOString(),
      };
    }

    // Simulate data fetching
    await new Promise((resolve) => globalThis.setTimeout(resolve, 200));

    return {
      id,
      message: `Dynamic cache for ID: ${id}`,
      timestamp: new Date().toISOString(),
      data: Array.from({ length: 5 }, (_, i) => ({
        item: i + 1,
        value: Math.random(),
      })),
    };
  }

  @Get("/manual")
  async manualCache(
    @QueryParam("refresh", { required: false }) refresh?: boolean,
  ): Promise<object> {
    const cacheKey = "manual-cache-demo";

    if (!refresh) {
      // Try to get from cache first
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return {
          ...cached,
          fromCache: true,
        };
      }
    }

    // Generate new data
    const data = {
      message: "Manually cached data",
      timestamp: new Date().toISOString(),
      randomData: Array.from({ length: 10 }, () => Math.random()),
      fromCache: false,
    };

    // Cache for 2 minutes
    await this.cacheService.set(cacheKey, data, 120);

    return data;
  }

  @Get("/expensive")
  async expensiveOperation(
    @QueryParam("category", { required: false }) category: string = "default",
  ): Promise<object> {
    return await this.cacheService.cache(
      `expensive-op-${category}`,
      async () => {
        // Simulate expensive computation
        await new Promise((resolve) => globalThis.setTimeout(resolve, 500));

        return {
          category,
          result: Math.random() * 1000,
          computation: "Very expensive calculation",
          timestamp: new Date().toISOString(),
        };
      },
      { ttl: 600, prefix: "expensive:" },
    );
  }

  @Get("/stats")
  async getCacheStats(): Promise<object> {
    const patterns = [
      "cache:*",
      "expensive:*",
      "dynamic-*",
      "manual-cache-demo",
    ];

    const stats: Record<string, object> = {};

    for (const pattern of patterns) {
      const keys = await this.cacheService.keys(pattern);
      stats[pattern] = {
        count: keys.length,
        keys: keys,
        ttls: await Promise.all(
          keys.map(async (key) => ({
            key,
            ttl: await this.cacheService.ttl(key),
          })),
        ),
      };
    }

    return {
      message: "Cache statistics",
      timestamp: new Date().toISOString(),
      stats,
    };
  }

  @Get("/clear")
  async clearCache(
    @QueryParam("pattern", { required: false }) pattern?: string,
  ): Promise<object> {
    let deletedCount = 0;

    if (pattern) {
      deletedCount = await this.cacheService.clearByPattern(pattern);
    } else {
      // Clear all demo cache keys
      const patterns = [
        "cache:*",
        "expensive:*",
        "dynamic-*",
        "manual-cache-demo",
      ];
      for (const p of patterns) {
        deletedCount += await this.cacheService.clearByPattern(p);
      }
    }

    return {
      message: "Cache cleared",
      deletedKeys: deletedCount,
      pattern: pattern || "all demo patterns",
      timestamp: new Date().toISOString(),
    };
  }
}
