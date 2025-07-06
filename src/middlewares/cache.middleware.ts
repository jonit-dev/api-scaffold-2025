import { Request, Response, NextFunction } from "express";
import { Container } from "typedi";
import crypto from "crypto";
import { CacheService } from "../services/cache.service";
import {
  CACHE_METADATA_KEY,
  ICacheConfig,
} from "../decorators/cache.decorator";

export interface ICacheMiddlewareOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
  prefix?: string;
}

/**
 * Generate a cache key based on request URL and query parameters
 */
function generateCacheKey(req: Request, prefix = "route:"): string {
  const url = req.originalUrl || req.url;
  const method = req.method;
  const hash = crypto
    .createHash("md5")
    .update(`${method}:${url}`)
    .digest("hex");
  return `${prefix}${hash}`;
}

/**
 * Cache middleware for Express routes
 */
export function cacheMiddleware(
  options: ICacheMiddlewareOptions = {},
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const defaultOptions: Required<ICacheMiddlewareOptions> = {
    ttl: 300, // 5 minutes
    keyGenerator: (req: Request) => generateCacheKey(req, options.prefix),
    condition: () => true,
    prefix: "route:",
    ...options,
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cacheService = Container.get(CacheService);

      // Only cache GET requests by default
      if (req.method !== "GET" || !defaultOptions.condition(req)) {
        return next();
      }

      const cacheKey = defaultOptions.keyGenerator(req);

      const cachedResponse = await cacheService.get(cacheKey);

      if (cachedResponse) {
        // Set cache headers
        res.set("X-Cache", "HIT");
        res.set("X-Cache-Key", cacheKey);

        res.json(cachedResponse);
        return;
      }

      // Cache miss - continue to route handler
      res.set("X-Cache", "MISS");
      res.set("X-Cache-Key", cacheKey);

      // Override res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = function (data: object): Response<object> {
        // Cache the response asynchronously
        cacheService.set(cacheKey, data, defaultOptions.ttl).catch((error) => {
          console.error("Failed to cache response:", error);
        });

        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error("Cache middleware error:", error);
      next();
    }
  };
}

/**
 * Decorator-aware cache middleware
 * This middleware checks for cache decorator metadata and applies caching accordingly
 */
export function decoratorCacheMiddleware(): (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction) => {
    const cacheService = Container.get(CacheService);
    // Only for GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Get route handler from express
    const route = req.route;
    if (!route) {
      return next();
    }

    // Try to get cache metadata from the route handler
    let cacheConfig: ICacheConfig | undefined;

    // Check if the current route has cache metadata
    if (route.stack && route.stack.length > 0) {
      for (const layer of route.stack) {
        if (layer.handle && typeof layer.handle === "function") {
          // Check the handler for cache metadata
          const metadata = Reflect.getMetadata(
            CACHE_METADATA_KEY,
            layer.handle,
          );
          if (metadata) {
            cacheConfig = metadata;
            break;
          }
        }
      }
    }

    if (!cacheConfig) {
      return next();
    }

    // Apply cache condition
    if (cacheConfig.condition && !cacheConfig.condition(req)) {
      return next();
    }

    // Generate cache key
    let cacheKey: string;
    if (cacheConfig.keyGenerator) {
      cacheKey = cacheConfig.keyGenerator(req);
    } else if (cacheConfig.key) {
      cacheKey = `${cacheConfig.prefix || "route:"}${cacheConfig.key}`;
    } else {
      cacheKey = generateCacheKey(req, cacheConfig.prefix);
    }

    try {
      const cachedResponse = await cacheService.get(cacheKey);

      if (cachedResponse) {
        // Set cache headers
        res.set("X-Cache", "HIT");
        res.set("X-Cache-Key", cacheKey);
        res.set("X-Cache-TTL", (cacheConfig.ttl || 300).toString());

        res.json(cachedResponse);
        return;
      }

      // Cache miss - continue to route handler
      res.set("X-Cache", "MISS");
      res.set("X-Cache-Key", cacheKey);

      // Override res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = function (data: object): Response<object> {
        // Cache the response asynchronously
        cacheService
          .set(cacheKey, data, cacheConfig!.ttl || 300)
          .catch((error: unknown) => {
            console.error("Failed to cache response:", error);
          });

        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error("Decorator cache middleware error:", error);
      next();
    }
  };
}

/**
 * Cache invalidation middleware
 */
export function cacheInvalidationMiddleware(
  pattern?: string,
): (req: Request, res: Response, next: NextFunction) => void {
  return async (req: Request, res: Response, next: NextFunction) => {
    const cacheService = Container.get(CacheService);
    // Override res.json to invalidate cache after response
    const originalJson = res.json.bind(res);
    res.json = function (data: object): Response<object> {
      // Invalidate cache asynchronously
      if (pattern) {
        cacheService.invalidateCachePattern(pattern).catch((error: unknown) => {
          console.error("Failed to invalidate cache:", error);
        });
      } else {
        // Default invalidation based on route
        const url = req.originalUrl || req.url;
        const invalidationPattern = `route:*${url.split("/")[1]}*`;
        cacheService
          .invalidateCachePattern(invalidationPattern)
          .catch((error: unknown) => {
            console.error("Failed to invalidate cache:", error);
          });
      }

      return originalJson(data);
    };

    next();
  };
}
