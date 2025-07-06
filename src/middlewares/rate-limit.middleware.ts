import { Request, Response, NextFunction } from "express";
import { Container } from "typedi";
import { CacheService } from "../services/cache.service";
import { TooManyRequestsException } from "../exceptions/http-exceptions";

export interface IRateLimitOptions {
  max: number; // Maximum number of requests
  windowMs: number; // Time window in milliseconds
  message?: string; // Custom error message
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Skip counting successful requests
  skipFailedRequests?: boolean; // Skip counting failed requests
}

export class RateLimitMiddleware {
  constructor(private options: IRateLimitOptions) {}

  async use(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const cacheService = Container.get(CacheService);
      const key = this.generateKey(request);
      const current = await this.getCurrentCount(key, cacheService);
      const remaining = Math.max(0, this.options.max - current);

      // Set rate limit headers
      response.setHeader("X-RateLimit-Limit", this.options.max);
      response.setHeader("X-RateLimit-Remaining", remaining);
      response.setHeader("X-RateLimit-Window", this.options.windowMs);

      if (current >= this.options.max) {
        const resetTime = await this.getResetTime(key, cacheService);
        response.setHeader("X-RateLimit-Reset", resetTime);

        throw new TooManyRequestsException(
          this.options.message || "Too many requests, please try again later",
        );
      }

      // Increment counter
      await this.incrementCounter(key, cacheService);

      next();
    } catch (error) {
      if (error instanceof TooManyRequestsException) {
        throw error;
      }
      // If Redis is down, allow the request through
      next();
    }
  }

  private generateKey(request: Request): string {
    if (this.options.keyGenerator) {
      return this.options.keyGenerator(request);
    }

    // Default key: IP + endpoint
    const ip = request.ip || request.connection.remoteAddress || "unknown";
    const endpoint = request.route?.path || request.path;
    return `rate_limit:${ip}:${endpoint}`;
  }

  private async getCurrentCount(
    key: string,
    cacheService: CacheService,
  ): Promise<number> {
    try {
      const count = await cacheService.get<string>(key);
      return count ? parseInt(count, 10) : 0;
    } catch {
      return 0;
    }
  }

  private async incrementCounter(
    key: string,
    cacheService: CacheService,
  ): Promise<void> {
    try {
      // Use atomic increment with expire
      await cacheService.incrWithExpire(
        key,
        Math.ceil(this.options.windowMs / 1000),
      );
    } catch {
      // If cache is down, silently fail
    }
  }

  private async getResetTime(
    key: string,
    cacheService: CacheService,
  ): Promise<number> {
    try {
      const ttl = await cacheService.ttl(key);
      return Date.now() + ttl * 1000;
    } catch {
      return Date.now() + this.options.windowMs;
    }
  }
}

// Factory function to create rate limit middleware instances
export function createRateLimitMiddleware(
  options: IRateLimitOptions,
): typeof RateLimitMiddleware {
  return class extends RateLimitMiddleware {
    constructor() {
      super(options);
    }
  };
}

// Predefined rate limit configurations for auth endpoints
export const authRateLimits = {
  register: {
    max: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: "Too many registration attempts, please try again later",
  },
  login: {
    max: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: "Too many login attempts, please try again later",
  },
  forgotPassword: {
    max: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: "Too many password reset requests, please try again later",
  },
  refresh: {
    max: 20,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: "Too many token refresh attempts, please try again later",
  },
  emailVerification: {
    max: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: "Too many email verification attempts, please try again later",
  },
  resendVerification: {
    max: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: "Too many verification email requests, please try again later",
  },
};
