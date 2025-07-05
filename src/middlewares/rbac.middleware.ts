import { Request, Response, NextFunction } from "express";
import { Service } from "typedi";
import { UserRole } from "../models/enums/user-roles.enum";
import { IAuthenticatedUser } from "../types/express";
import {
  UnauthorizedException,
  ForbiddenException,
} from "../exceptions/http-exceptions";

@Service()
export class RbacMiddleware {
  constructor(private requiredRoles: UserRole[]) {}

  use(request: Request, response: Response, next: NextFunction): void {
    try {
      const user = request.user as IAuthenticatedUser;

      if (!user) {
        throw new UnauthorizedException("Authentication required");
      }

      if (!this.hasRequiredRole(user.role, this.requiredRoles)) {
        throw new ForbiddenException("Insufficient permissions");
      }

      next();
    } catch (error) {
      next(error);
    }
  }

  private hasRequiredRole(
    userRole: UserRole,
    requiredRoles: UserRole[],
  ): boolean {
    // Admin has access to everything
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    return requiredRoles.includes(userRole);
  }
}

// Factory function to create role middleware instances
export function createRoleMiddleware(...roles: UserRole[]): RbacMiddleware {
  return new RbacMiddleware(roles);
}
