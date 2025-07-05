import { Container } from "typedi";
import { Request, Response } from "express";
import { AuthMiddleware } from "../middlewares/auth.middleware";
import { createRoleMiddleware } from "../middlewares/rbac.middleware";
import { UserRole } from "../models/enums/user-roles.enum";
import { IAuthenticatedUser } from "../types/express";
import { AuthService } from "../services/auth.service";
import { User } from "@supabase/supabase-js";

// Authentication decorator - requires valid JWT token
export function Authenticated(): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): void {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      // Extract request, response, and next from arguments
      const req = args.find(
        arg => arg && typeof arg === "object" && "headers" in arg,
      );
      const res = args.find(
        arg => arg && typeof arg === "object" && "json" in arg,
      );

      if (req && res) {
        const authMiddleware = Container.get(AuthMiddleware);

        // Create a promise to handle next function
        let nextCalled = false;
        const next = (error?: unknown): void => {
          nextCalled = true;
          if (error) {
            throw error;
          }
        };

        await authMiddleware.use(req as Request, res as Response, next);

        if (nextCalled) {
          return originalMethod.apply(this, args);
        }
      }

      return originalMethod.apply(this, args);
    };
  };
}

// Role-based access control decorator
export function RequireRole(...roles: UserRole[]): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): void {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      // Extract request, response, and next from arguments
      const req = args.find(
        arg => arg && typeof arg === "object" && "headers" in arg,
      );
      const res = args.find(
        arg => arg && typeof arg === "object" && "json" in arg,
      );

      if (req && res) {
        const authMiddleware = Container.get(AuthMiddleware);
        const roleMiddleware = createRoleMiddleware(...roles);

        // Create a promise to handle next function
        let nextCalled = false;
        const next = (error?: unknown): void => {
          nextCalled = true;
          if (error) {
            throw error;
          }
        };

        await authMiddleware.use(req as Request, res as Response, next);
        if (nextCalled) {
          nextCalled = false;
          await roleMiddleware.use(req as Request, res as Response, next);
        }

        if (nextCalled) {
          return originalMethod.apply(this, args);
        }
      }

      return originalMethod.apply(this, args);
    };
  };
}

// Optional authentication decorator - doesn't throw if no token
export function OptionalAuth(): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): void {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const request = args.find(
        arg => arg && typeof arg === "object" && "headers" in arg,
      ) as Request;

      if (request) {
        try {
          const token = extractTokenFromHeader(request);

          if (token) {
            const supabaseAuth = Container.get("supabaseAuth") as {
              auth: {
                getUser: (
                  token: string,
                ) => Promise<{ data: { user: User | null }; error: unknown }>;
              };
            };
            const {
              data: { user },
              error,
            } = await supabaseAuth.auth.getUser(token);

            if (!error && user) {
              const authService = Container.get(AuthService);
              const userProfile = await authService.getUserProfile(user.id);

              const authenticatedUser: IAuthenticatedUser = {
                id: user.id,
                email: user.email!,
                role: userProfile.role,
                supabaseUser: user,
              };

              (request as { user: IAuthenticatedUser }).user =
                authenticatedUser;
            }
          }
        } catch {
          // Ignore authentication errors for optional auth
        }
      }

      return originalMethod.apply(this, args);
    };
  };
}

// Current user parameter decorator - injects authenticated user into method parameter
export function CurrentUser(): ParameterDecorator {
  return function (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number,
  ): void {
    if (!propertyKey) return;

    // Store metadata about which parameter should receive the current user
    const existingMetadata =
      Reflect.getMetadata("custom:currentUser", target, propertyKey) || [];
    existingMetadata.push(parameterIndex);
    Reflect.defineMetadata(
      "custom:currentUser",
      existingMetadata,
      target,
      propertyKey,
    );

    // Get the original method
    const originalMethod = (target as Record<string | symbol, unknown>)[
      propertyKey
    ];

    // Override the method to inject user
    (target as Record<string | symbol, unknown>)[propertyKey] = function (
      ...args: unknown[]
    ): unknown {
      // Find the request object
      const request = args.find(
        arg => arg && typeof arg === "object" && "user" in arg,
      ) as { user: IAuthenticatedUser };

      if (request && request.user) {
        // Inject the user at the specified parameter index
        args[parameterIndex] = request.user;
      }

      return (originalMethod as (...args: unknown[]) => unknown).apply(
        this,
        args,
      );
    };
  };
}

// Helper function to extract token from request header
function extractTokenFromHeader(request: {
  headers?: { authorization?: string };
}): string | null {
  const authorization = request.headers?.authorization;

  if (!authorization) {
    return null;
  }

  const [type, token] = authorization.split(" ");

  if (type !== "Bearer" || !token) {
    return null;
  }

  return token;
}
