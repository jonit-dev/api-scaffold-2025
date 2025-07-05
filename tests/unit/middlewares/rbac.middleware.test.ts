import { describe, it, expect, beforeEach } from "vitest";
import {
  RbacMiddleware,
  createRoleMiddleware,
} from "../../../src/middlewares/rbac.middleware";
import { UserRole } from "@models/enums/user-roles.enum";
import {
  UnauthorizedException,
  ForbiddenException,
} from "@exceptions/http-exceptions";
import { AuthFactory } from "../../factories/auth.factory";

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
      const rbacMiddleware = new RbacMiddleware([UserRole.USER]);
      const authenticatedUser = AuthFactory.createAuthenticatedUser({
        role: UserRole.USER,
      });
      mockRequest.user = authenticatedUser;

      rbacMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should allow admin access to any role requirement", () => {
      const rbacMiddleware = new RbacMiddleware([UserRole.MODERATOR]);
      const adminUser = AuthFactory.createAuthenticatedUser({
        role: UserRole.ADMIN,
      });
      mockRequest.user = adminUser;

      rbacMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should allow access when user has one of multiple required roles", () => {
      const rbacMiddleware = new RbacMiddleware([
        UserRole.ADMIN,
        UserRole.MODERATOR,
      ]);
      const moderatorUser = AuthFactory.createAuthenticatedUser({
        role: UserRole.MODERATOR,
      });
      mockRequest.user = moderatorUser;

      rbacMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should throw UnauthorizedException when no user in request", () => {
      const rbacMiddleware = new RbacMiddleware([UserRole.USER]);
      mockRequest.user = undefined;

      rbacMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockNext.mock.calls[0][0].message).toBe("Authentication required");
    });

    it("should throw ForbiddenException when user lacks required role", () => {
      const rbacMiddleware = new RbacMiddleware([UserRole.ADMIN]);
      const regularUser = AuthFactory.createAuthenticatedUser({
        role: UserRole.USER,
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
        UserRole.ADMIN,
        UserRole.MODERATOR,
      ]);
      const regularUser = AuthFactory.createAuthenticatedUser({
        role: UserRole.USER,
      });
      mockRequest.user = regularUser;

      rbacMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenException));
      expect(mockNext.mock.calls[0][0].message).toBe(
        "Insufficient permissions",
      );
    });

    it("should handle errors by passing them to next", () => {
      const rbacMiddleware = new RbacMiddleware([UserRole.USER]);
      // Simulate an error by making user undefined but still present
      mockRequest.user = null;

      rbacMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    });
  });

  describe("hasRequiredRole", () => {
    let rbacMiddleware: RbacMiddleware;

    beforeEach(() => {
      rbacMiddleware = new RbacMiddleware([UserRole.USER]);
    });

    it("should return true when admin role checking any role", () => {
      const hasRole = (rbacMiddleware as any).hasRequiredRole(UserRole.ADMIN, [
        UserRole.USER,
        UserRole.MODERATOR,
      ]);

      expect(hasRole).toBe(true);
    });

    it("should return true when user role matches required role", () => {
      const hasRole = (rbacMiddleware as any).hasRequiredRole(UserRole.USER, [
        UserRole.USER,
      ]);

      expect(hasRole).toBe(true);
    });

    it("should return true when user role is in required roles list", () => {
      const hasRole = (rbacMiddleware as any).hasRequiredRole(
        UserRole.MODERATOR,
        [UserRole.USER, UserRole.MODERATOR, UserRole.ADMIN],
      );

      expect(hasRole).toBe(true);
    });

    it("should return false when user role is not in required roles list", () => {
      const hasRole = (rbacMiddleware as any).hasRequiredRole(UserRole.USER, [
        UserRole.ADMIN,
        UserRole.MODERATOR,
      ]);

      expect(hasRole).toBe(false);
    });

    it("should return false when required roles list is empty", () => {
      const hasRole = (rbacMiddleware as any).hasRequiredRole(
        UserRole.USER,
        [],
      );

      expect(hasRole).toBe(false);
    });
  });

  describe("createRoleMiddleware", () => {
    it("should create middleware with single role", () => {
      const middleware = createRoleMiddleware(UserRole.ADMIN);

      expect(middleware).toBeInstanceOf(RbacMiddleware);
      expect((middleware as any).requiredRoles).toEqual([UserRole.ADMIN]);
    });

    it("should create middleware with multiple roles", () => {
      const middleware = createRoleMiddleware(
        UserRole.ADMIN,
        UserRole.MODERATOR,
      );

      expect(middleware).toBeInstanceOf(RbacMiddleware);
      expect((middleware as any).requiredRoles).toEqual([
        UserRole.ADMIN,
        UserRole.MODERATOR,
      ]);
    });

    it("should create different instances for different calls", () => {
      const middleware1 = createRoleMiddleware(UserRole.ADMIN);
      const middleware2 = createRoleMiddleware(UserRole.USER);

      expect(middleware1).not.toBe(middleware2);
      expect((middleware1 as any).requiredRoles).toEqual([UserRole.ADMIN]);
      expect((middleware2 as any).requiredRoles).toEqual([UserRole.USER]);
    });
  });

  describe("Integration scenarios", () => {
    it("should work correctly in a typical admin-only scenario", () => {
      const adminOnlyMiddleware = createRoleMiddleware(UserRole.ADMIN);

      // Test with admin user
      const adminUser = AuthFactory.createAuthenticatedUser({
        role: UserRole.ADMIN,
      });
      mockRequest.user = adminUser;
      adminOnlyMiddleware.use(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith();

      // Reset mock
      mockNext.mockClear();

      // Test with regular user
      const regularUser = AuthFactory.createAuthenticatedUser({
        role: UserRole.USER,
      });
      mockRequest.user = regularUser;
      adminOnlyMiddleware.use(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenException));
    });

    it("should work correctly in a moderator-or-admin scenario", () => {
      const moderatorOrAdminMiddleware = createRoleMiddleware(
        UserRole.MODERATOR,
        UserRole.ADMIN,
      );

      // Test with moderator user
      const moderatorUser = AuthFactory.createAuthenticatedUser({
        role: UserRole.MODERATOR,
      });
      mockRequest.user = moderatorUser;
      moderatorOrAdminMiddleware.use(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith();

      // Reset mock
      mockNext.mockClear();

      // Test with admin user (should also work)
      const adminUser = AuthFactory.createAuthenticatedUser({
        role: UserRole.ADMIN,
      });
      mockRequest.user = adminUser;
      moderatorOrAdminMiddleware.use(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith();

      // Reset mock
      mockNext.mockClear();

      // Test with regular user (should fail)
      const regularUser = AuthFactory.createAuthenticatedUser({
        role: UserRole.USER,
      });
      mockRequest.user = regularUser;
      moderatorOrAdminMiddleware.use(mockRequest, mockResponse, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenException));
    });
  });
});
