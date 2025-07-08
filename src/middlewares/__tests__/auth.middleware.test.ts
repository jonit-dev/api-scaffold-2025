import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuthMiddleware } from "../auth.middleware";
import { Request, Response, NextFunction } from "express";
import { Container } from "typedi";
import { AuthService } from "../../services/auth.service";
import { UnauthorizedException } from "../../exceptions/http-exceptions";
import { UserRole } from "../../models/enums/user-roles.enum";

describe("AuthMiddleware Tests", () => {
  let authMiddleware: AuthMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockAuthService: any;

  beforeEach(() => {
    // Clear any existing mocks
    vi.clearAllMocks();

    // Reset the Container
    Container.reset();

    // Mock AuthService
    mockAuthService = {
      verifyUser: vi.fn(),
    };

    Container.set(AuthService, mockAuthService);
    authMiddleware = new AuthMiddleware(mockAuthService);

    mockRequest = {
      headers: {},
      path: "/test",
      method: "GET",
      user: undefined, // Initialize the user property
    } as Partial<Request>;

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn() as NextFunction;
  });

  describe("Valid Token", () => {
    it("should allow access with valid bearer token", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        role: UserRole.User,
        firstName: "Test",
        lastName: "User",
      };

      mockRequest.headers = {
        authorization: "Bearer valid-token-123",
      };

      mockAuthService.verifyUser.mockResolvedValue(mockUser);

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockRequest.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(mockNext).toHaveBeenCalledOnce();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should handle token verification", async () => {
      mockRequest.headers = {
        authorization: "Bearer valid-token-123",
      };

      const authService = Container.get(AuthService) as any;
      authService.verifyUser.mockResolvedValue({
        id: "user-123",
        email: "test@example.com",
        role: UserRole.User,
        firstName: "Test",
        lastName: "User",
      });

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(authService.verifyUser).toHaveBeenCalledWith("valid-token-123");
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });

  describe("Invalid Token", () => {
    it("should reject request with invalid token", async () => {
      mockRequest.headers = {
        authorization: "Bearer invalid-token",
      };

      const authService = Container.get(AuthService) as any;
      authService.verifyUser.mockRejectedValue(
        new UnauthorizedException("Invalid token"),
      );

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    });

    it("should reject request with expired token", async () => {
      mockRequest.headers = {
        authorization: "Bearer expired-token",
      };

      const authService = Container.get(AuthService) as any;
      authService.verifyUser.mockRejectedValue(
        new UnauthorizedException("Token expired"),
      );

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    });
  });

  describe("Missing Token", () => {
    it("should reject request without authorization header", async () => {
      mockRequest.headers = {};

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    });

    it("should reject request with empty authorization header", async () => {
      mockRequest.headers = {
        authorization: "",
      };

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    });

    it("should reject request with non-Bearer token", async () => {
      mockRequest.headers = {
        authorization: "Basic dXNlcjpwYXNz",
      };

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    });

    it("should reject request with Bearer but no token", async () => {
      mockRequest.headers = {
        authorization: "Bearer",
      };

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    });
  });

  describe("User Data", () => {
    it("should attach user data to request object", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        role: UserRole.Admin,
      };

      mockRequest.headers = {
        authorization: "Bearer valid-token-123",
      };

      mockAuthService.verifyUser.mockResolvedValue(mockUser);

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockRequest.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(mockRequest.user?.id).toBe("user-123");
      expect(mockRequest.user?.email).toBe("test@example.com");
      expect(mockRequest.user?.role).toBe(UserRole.Admin);
    });

    it("should handle user not found scenario", async () => {
      mockRequest.headers = {
        authorization: "Bearer valid-token-but-user-deleted",
      };

      const authService = Container.get(AuthService) as any;
      authService.verifyUser.mockRejectedValue(
        new UnauthorizedException("User not found"),
      );

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    });
  });

  describe("Service Errors", () => {
    it("should handle auth service errors gracefully", async () => {
      mockRequest.headers = {
        authorization: "Bearer valid-token-123",
      };

      const authService = Container.get(AuthService) as any;
      authService.verifyUser.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    });
  });

  describe("Token Formats", () => {
    it("should handle token with extra spaces", async () => {
      mockRequest.headers = {
        authorization: "  Bearer   valid-token-123  ",
      };

      const authService = Container.get(AuthService) as any;
      authService.verifyUser.mockResolvedValue({
        id: "user-123",
        email: "test@example.com",
        role: UserRole.User,
        firstName: "Test",
        lastName: "User",
      });

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(authService.verifyUser).toHaveBeenCalledWith("valid-token-123");
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it("should handle case-insensitive Bearer keyword", async () => {
      mockRequest.headers = {
        authorization: "bearer valid-token-123",
      };

      const authService = Container.get(AuthService) as any;
      authService.verifyUser.mockResolvedValue({
        id: "user-123",
        email: "test@example.com",
        role: UserRole.User,
        firstName: "Test",
        lastName: "User",
      });

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(authService.verifyUser).toHaveBeenCalledWith("valid-token-123");
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });
});
