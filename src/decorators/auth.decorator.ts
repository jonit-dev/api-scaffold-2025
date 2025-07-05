import { Middleware } from "routing-controllers";
import { Container } from "typedi";
import { AuthMiddleware } from "../middlewares/auth.middleware";
import { createRoleMiddleware } from "../middlewares/rbac.middleware";
import { UserRole } from "../models/enums";
import { AuthenticatedUser } from "../types/express";
import { AuthService } from "../services/auth.service";

// Authentication decorator - requires valid JWT token
export function Authenticated() {
  return Middleware({
    type: "before",
  })((target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const request = args[0];
      const response = args[1];
      const next = args[2];

      const authMiddleware = Container.get(AuthMiddleware);
      await authMiddleware.use(request, response, next);

      return originalMethod.apply(this, args);
    };
  });
}

// Role-based access control decorator
export function RequireRole(...roles: UserRole[]) {
  return Middleware({
    type: "before",
  })((target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const request = args[0];
      const response = args[1];
      const next = args[2];

      const authMiddleware = Container.get(AuthMiddleware);
      const roleMiddleware = createRoleMiddleware(...roles);

      await authMiddleware.use(request, response, next);
      await roleMiddleware.use(request, response, next);

      return originalMethod.apply(this, args);
    };
  });
}

// Optional authentication decorator - doesn't throw if no token
export function OptionalAuth() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const request = args.find(arg => arg && arg.headers);

      if (request) {
        try {
          const token = extractTokenFromHeader(request);

          if (token) {
            const supabaseAuth = Container.get("supabaseAuth") as any;
            const {
              data: { user },
              error,
            } = await supabaseAuth.auth.getUser(token);

            if (!error && user) {
              const authService = Container.get(AuthService);
              const userProfile = await authService.getUserProfile(user.id);

              const authenticatedUser: AuthenticatedUser = {
                id: user.id,
                email: user.email!,
                role: userProfile.role,
                supabaseUser: user,
              };

              request.user = authenticatedUser;
            }
          }
        } catch (error) {
          // Ignore authentication errors for optional auth
        }
      }

      return originalMethod.apply(this, args);
    };
  };
}

// Current user parameter decorator - injects authenticated user into method parameter
export function CurrentUser() {
  return function (target: any, propertyKey: string, parameterIndex: number) {
    // Store metadata about which parameter should receive the current user
    const existingMetadata =
      Reflect.getMetadata("custom:currentUser", target, propertyKey) || [];
    existingMetadata.push(parameterIndex);
    Reflect.defineMetadata(
      "custom:currentUser",
      existingMetadata,
      target,
      propertyKey
    );

    // Get the original method
    const originalMethod = target[propertyKey];

    // Override the method to inject user
    target[propertyKey] = function (...args: any[]) {
      // Find the request object
      const request = args.find(arg => arg && arg.user);

      if (request && request.user) {
        // Inject the user at the specified parameter index
        args[parameterIndex] = request.user;
      }

      return originalMethod.apply(this, args);
    };
  };
}

// Helper function to extract token from request header
function extractTokenFromHeader(request: any): string | null {
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
