import { Interceptor, InterceptorInterface, Action } from "routing-controllers";
import { Container, Service } from "typedi";
import { RedisService } from "../services/redis.service";
import {
  CACHE_METADATA_KEY,
  ICacheConfig,
} from "../decorators/cache.decorator";
import crypto from "crypto";

/**
 * Generate a cache key based on request URL and query parameters
 */
function generateCacheKey(action: Action, prefix = "route:"): string {
  const url = action.request.originalUrl || action.request.url;
  const method = action.request.method;
  const hash = crypto
    .createHash("md5")
    .update(`${method}:${url}`)
    .digest("hex");
  return `${prefix}${hash}`;
}

@Interceptor()
@Service()
export class CacheInterceptor implements InterceptorInterface {
  async intercept(action: Action, content: unknown): Promise<unknown> {
    const redisService = Container.get(RedisService);

    // Only cache GET requests
    if (action.request.method !== "GET") {
      return content;
    }

    // Get cache metadata from the controller method
    if (!action.context) {
      return content;
    }

    const cacheConfig: ICacheConfig = Reflect.getMetadata(
      CACHE_METADATA_KEY,
      action.context.constructor.prototype,
      action.context.method,
    );

    if (!cacheConfig) {
      return content;
    }

    // Apply cache condition
    if (cacheConfig.condition && !cacheConfig.condition(action.request)) {
      return content;
    }

    // Generate cache key
    let cacheKey: string;
    if (cacheConfig.keyGenerator) {
      cacheKey = cacheConfig.keyGenerator(action.request);
    } else if (cacheConfig.key) {
      cacheKey = `${cacheConfig.prefix || "route:"}${cacheConfig.key}`;
    } else {
      cacheKey = generateCacheKey(action, cacheConfig.prefix);
    }

    try {
      // Check if we already have a cached response
      const cachedResponse = await redisService.get(cacheKey);

      if (cachedResponse) {
        // Set cache headers
        action.response.set("X-Cache", "HIT");
        action.response.set("X-Cache-Key", cacheKey);
        action.response.set("X-Cache-TTL", (cacheConfig.ttl || 300).toString());

        return cachedResponse;
      }

      // Cache miss - set headers and cache the response
      action.response.set("X-Cache", "MISS");
      action.response.set("X-Cache-Key", cacheKey);
      action.response.set("X-Cache-TTL", (cacheConfig.ttl || 300).toString());

      // Cache the response content
      if (content) {
        redisService
          .set(cacheKey, content, cacheConfig.ttl || 300)
          .catch((error) => {
            console.error("Failed to cache response:", error);
          });
      }

      return content;
    } catch (error) {
      console.error("Cache interceptor error:", error);
      return content;
    }
  }
}
