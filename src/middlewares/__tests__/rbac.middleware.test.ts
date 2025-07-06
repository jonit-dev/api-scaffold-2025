import { beforeEach, describe, expect, it } from "vitest";

import {
  ForbiddenException,
  UnauthorizedException,
} from "@exceptions/http-exceptions";
import { UserRole } from "@models/enums/user-roles.enum";
import { AuthFactory } from "@tests/factories/auth.factory";
import { RbacMiddleware, createRoleMiddleware } from "../rbac.middleware";

describe("RbacMiddleware", () => {
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: any;

  beforeEach(() => {
    mockRequest = {
      user: undefined,
    };
    mockResponse = AuthFactory.createMockResponse();
    mockNext = AuthFactory.createMockNext();
  });

  describe("use", () => {
    it("should allow access when user has required role", () => {
      const rbacMiddleware = new RbacMiddleware([UserRole.User]);
      const authenticatedUser = AuthFactory.createAuthenticatedUser({
        role: UserRole.User,
      });
      mockRequest.user = authenticatedUser;

      rbacMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should allow admin access to any role requirement", () => {
      const rbacMiddleware = new RbacMiddleware([UserRole.Moderator]);
      const adminUser = AuthFactory.createAuthenticatedUser({
        role: UserRole.Admin,
      });
      mockRequest.user = adminUser;

      rbacMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should allow access when user has one of multiple required roles", () => {
      const rbacMiddleware = new RbacMiddleware([
        UserRole.Admin,
        UserRole.Moderator,
      ]);
      const moderatorUser = AuthFactory.createAuthenticatedUser({
        role: UserRole.Moderator,
      });
      mockRequest.user = moderatorUser;

      rbacMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should throw UnauthorizedException when no user in request", () => {
      const rbacMiddleware = new RbacMiddleware([UserRole.User]);
      mockRequest.user = undefined;

      rbacMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockNext.mock.calls[0][0].message).toBe("Authentication required");
    });

    it("should throw ForbiddenException when user lacks required role", () => {
      const rbacMiddleware = new RbacMiddleware([UserRole.Admin]);
      const regularUser = AuthFactory.createAuthenticatedUser({
        role: UserRole.User,
      });
      mockRequest.user = regularUser;

      rbacMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenException));
      expect(mockNext.mock.calls[0][0].message).toBe(
        "Insufficient permissions",
      );
    });

    it("should throw ForbiddenException when user has wrong role from multiple options", () => {
      const rbacMiddleware = new RbacMiddleware([
        UserRole.Admin,
        UserRole.Moderator,
      ]);
      const regularUser = AuthFactory.createAuthenticatedUser({
        role: UserRole.User,
      });
      mockRequest.user = regularUser;

      rbacMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenException));
      expect(mockNext.mock.calls[0][0].message).toBe(
        "Insufficient permissions",
      );
    });

    it("should handle errors by passing them to next", () => {
      const rbacMiddleware = new RbacMiddleware([UserRole.User]);
      // Simulate an error by making user undefined but still present
      mockRequest.user = null;

      rbacMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    });
  });

  describe("hasRequiredRole", () => {
    let rbacMiddleware: RbacMiddleware;

    beforeEach(() => {
      rbacMiddleware = new RbacMiddleware([UserRole.User]);
    });

    it("should return true when admin role checking any role", () => {
      const hasRole = (rbacMiddleware as any).hasRequiredRole(UserRole.Admin, [
        UserRole.User,
        UserRole.Moderator,
      ]);

      expect(hasRole).toBe(true);
    });

    it("should return true when user role matches required role", () => {
      const hasRole = (rbacMiddleware as any).hasRequiredRole(UserRole.User, [
        UserRole.User,
      ]);

      expect(hasRole).toBe(true);
    });

    it("should return true when user role is in required roles list", () => {
      const hasRole = (rbacMiddleware as any).hasRequiredRole(
        UserRole.Moderator,
        [UserRole.User, UserRole.Moderator, UserRole.Admin],
      );

      expect(hasRole).toBe(true);
    });

    it("should return false when user role is not in required roles list", () => {
      const hasRole = (rbacMiddleware as any).hasRequiredRole(UserRole.User, [
        UserRole.Admin,
        UserRole.Moderator,
      ]);

      expect(hasRole).toBe(false);
    });

    it("should return false when required roles list is empty", () => {
      const hasRole = (rbacMiddleware as any).hasRequiredRole(
        UserRole.User,
        [],
      );

      expect(hasRole).toBe(false);
    });
  });

  describe("createRoleMiddleware", () => {
    it("should create middleware with single role", () => {
      const middleware = createRoleMiddleware(UserRole.Admin);

      expect(middleware).toBeInstanceOf(RbacMiddleware);
      expect((middleware as any).requiredRoles).toEqual([UserRole.Admin]);
    });

    it("should create middleware with multiple roles", () => {
      const middleware = createRoleMiddleware(
        UserRole.Admin,
        UserRole.Moderator,
      );

      expect(middleware).toBeInstanceOf(RbacMiddleware);
      expect((middleware as any).requiredRoles).toEqual([
        UserRole.Admin,
        UserRole.Moderator,
      ]);
    });

    it("should create different instances for different calls", () => {
      const middleware1 = createRoleMiddleware(UserRole.Admin);
      const middleware2 = createRoleMiddleware(UserRole.User);

      expect(middleware1).not.toBe(middleware2);
      expect((middleware1 as any).requiredRoles).toEqual([UserRole.Admin]);
      expect((middleware2 as any).requiredRoles).toEqual([UserRole.User]);
    });
  });

  describe("Integration scenarios", () => {
    it("should work correctly in a typical admin-only scenario", () => {
      const adminOnlyMiddleware = createRoleMiddleware(UserRole.Admin);

      // Test with admin user
      const adminUser = AuthFactory.createAuthenticatedUser({
        role: UserRole.Admin,
      });
      mockRequest.user = adminUser;
      adminOnlyMiddleware.use(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith();

      // Reset mock
      mockNext.mockClear();

      // Test with regular user
      const regularUser = AuthFactory.createAuthenticatedUser({
        role: UserRole.User,
      });
      mockRequest.user = regularUser;
      adminOnlyMiddleware.use(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenException));
    });

    it("should work correctly in a moderator-or-admin scenario", () => {
      const moderatorOrAdminMiddleware = createRoleMiddleware(
        UserRole.Moderator,
        UserRole.Admin,
      );

      // Test with moderator user
      const moderatorUser = AuthFactory.createAuthenticatedUser({
        role: UserRole.Moderator,
      });
      mockRequest.user = moderatorUser;
      moderatorOrAdminMiddleware.use(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith();

      // Reset mock
      mockNext.mockClear();

      // Test with admin user (should also work)
      const adminUser = AuthFactory.createAuthenticatedUser({
        role: UserRole.Admin,
      });
      mockRequest.user = adminUser;
      moderatorOrAdminMiddleware.use(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith();

      // Reset mock
      mockNext.mockClear();

      // Test with regular user (should fail)
      const regularUser = AuthFactory.createAuthenticatedUser({
        role: UserRole.User,
      });
      mockRequest.user = regularUser;
      moderatorOrAdminMiddleware.use(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenException));
    });
  });
});
