import { NextFunction, Request, Response } from "express";
import { UseBefore, createParamDecorator } from "routing-controllers";
import { Container } from "typedi";
import { AuthMiddleware } from "../middlewares/auth.middleware";
import { createRoleMiddleware } from "../middlewares/rbac.middleware";
import { UserRole } from "../models/enums/user-roles.enum";
import { IAuthenticatedUser } from "../types/express";
import { extractBearerToken } from "../utils/auth.utils";

// Authentication decorator - requires valid JWT token
export function Authenticated(): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): void {
    // Create middleware function that routing-controllers can use
    const authMiddleware = (
      req: Request,
      res: Response,
      next: NextFunction,
    ): void => {
      const authMiddlewareInstance = Container.get(AuthMiddleware);
      // Call the middleware and ensure it properly handles the next callback
      authMiddlewareInstance.use(req, res, next).catch(next);
    };

    return UseBefore(authMiddleware)(target, propertyKey, descriptor);
  };
}

// Role-based access control decorator
export function RequireRole(...roles: UserRole[]): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): void {
    // Create middleware functions that routing-controllers can use
    const authMiddleware = (
      req: Request,
      res: Response,
      next: NextFunction,
    ): void => {
      const authMiddlewareInstance = Container.get(AuthMiddleware);
      authMiddlewareInstance.use(req, res, next).catch(next);
    };

    const roleMiddleware = (
      req: Request,
      res: Response,
      next: NextFunction,
    ): void => {
      const roleMiddlewareInstance = createRoleMiddleware(...roles);
      roleMiddlewareInstance.use(req, res, next);
    };

    return UseBefore(authMiddleware, roleMiddleware)(
      target,
      propertyKey,
      descriptor,
    );
  };
}

// Optional authentication decorator - doesn't throw if no token
export function OptionalAuth(): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): void {
    // Create middleware function that routing-controllers can use
    const optionalAuthMiddleware = (
      req: Request,
      res: Response,
      next: NextFunction,
    ): void => {
      try {
        const token = extractBearerToken(req);

        if (token) {
          const authService = Container.get("AuthService") as {
            verifyToken: (token: string) => Promise<IAuthenticatedUser>;
          };
          // Try to verify token but don't throw if invalid
          authService
            .verifyToken(token)
            .then((user: IAuthenticatedUser) => {
              req.user = user;
              next();
            })
            .catch(() => {
              // If auth fails, continue without user
              next();
            });
        } else {
          // No token provided, continue without user
          next();
        }
      } catch {
        // If anything fails, continue without user
        next();
      }
    };

    return UseBefore(optionalAuthMiddleware)(target, propertyKey, descriptor);
  };
}

// Current user parameter decorator - injects authenticated user into method parameter
export function CurrentUser(options?: {
  required?: boolean;
}): (object: object, method: string, index: number) => void {
  return createParamDecorator({
    required: options?.required ?? false,
    value: (action) => {
      const req = action.request as Request & { user?: IAuthenticatedUser };
      return req.user;
    },
  });
}
