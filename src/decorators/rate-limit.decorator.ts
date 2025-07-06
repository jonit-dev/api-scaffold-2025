import { NextFunction, Request, Response } from "express";
import { UseBefore } from "routing-controllers";
import {
  IRateLimitOptions,
  RateLimitMiddleware,
} from "../middlewares/rate-limit.middleware";

export function RateLimit(options: IRateLimitOptions): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): void {
    // Create middleware function that routing-controllers can use
    const rateLimitMiddleware = (
      req: Request,
      res: Response,
      next: NextFunction,
    ): void => {
      // Create the middleware instance directly
      const rateLimitMiddlewareInstance = new RateLimitMiddleware(options);
      // Call the middleware and ensure it properly handles the next callback
      rateLimitMiddlewareInstance.use(req, res, next).catch(next);
    };

    return UseBefore(rateLimitMiddleware)(target, propertyKey, descriptor);
  };
}
