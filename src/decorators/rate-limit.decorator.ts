import { Container } from "typedi";
import { Request, Response } from "express";
import {
  createRateLimitMiddleware,
  IRateLimitOptions,
} from "../middlewares/rate-limit.middleware";

export function RateLimit(options: IRateLimitOptions): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): void {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      // Extract request and response from arguments
      const req = args.find(
        (arg) => arg && typeof arg === "object" && "headers" in arg,
      ) as Request;
      const res = args.find(
        (arg) => arg && typeof arg === "object" && "json" in arg,
      ) as Response;

      if (req && res) {
        const RateLimitMiddlewareClass = createRateLimitMiddleware(options);
        const rateLimitMiddleware = Container.get(RateLimitMiddlewareClass);

        // Create a promise to handle next function
        let nextCalled = false;
        const next = (error?: unknown): void => {
          nextCalled = true;
          if (error) {
            throw error;
          }
        };

        await rateLimitMiddleware.use(req, res, next);

        if (nextCalled) {
          return originalMethod.apply(this, args);
        }
      }

      return originalMethod.apply(this, args);
    };
  };
}
