import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuthMiddleware } from "../auth.middleware";
import { Request, Response } from "express";
import { Container } from "typedi";
import { AuthService } from "../../services/auth.service";
import { LoggerService } from "../../services/logger.service";
import { UnauthorizedException } from "../../exceptions/http-exceptions";

describe("AuthMiddleware Tests", () => {
  let authMiddleware: AuthMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: vi.Mock;

  beforeEach(() => {
    // Mock services
    const mockAuthService = {
      verifyToken: vi.fn(),
      getUserFromToken: vi.fn(),
    };

    const mockLoggerService = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };

    Container.set(AuthService, mockAuthService);
    Container.set(LoggerService, mockLoggerService);

    authMiddleware = new AuthMiddleware();

    mockRequest = {
      headers: {},
      path: "/test",
      method: "GET",
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe("Valid Token", () => {
    it("should allow access with valid bearer token", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        role: "user",
        isEmailVerified: true,
      };

      mockRequest.headers = {
        authorization: "Bearer valid-token-123",
      };

      const authService = Container.get(AuthService) as any;
      authService.verifyToken.mockResolvedValue({
        valid: true,
        payload: { userId: "user-123" },
      });
      authService.getUserFromToken.mockResolvedValue(mockUser);

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockRequest.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalledOnce();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it("should handle token verification", async () => {
      mockRequest.headers = {
        authorization: "Bearer valid-token-123",
      };

      const authService = Container.get(AuthService) as any;
      authService.verifyToken.mockResolvedValue({
        valid: true,
        payload: {
          userId: "user-123",
          email: "test@example.com",
          role: "user",
        },
      });
      authService.getUserFromToken.mockResolvedValue({
        id: "user-123",
        email: "test@example.com",
        role: "user",
        isEmailVerified: true,
      });

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(authService.verifyToken).toHaveBeenCalledWith("valid-token-123");
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });

  describe("Invalid Token", () => {
    it("should reject request with invalid token", async () => {
      mockRequest.headers = {
        authorization: "Bearer invalid-token",
      };

      const authService = Container.get(AuthService) as any;
      authService.verifyToken.mockResolvedValue({
        valid: false,
        error: "Invalid token",
      });

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
      authService.verifyToken.mockResolvedValue({
        valid: false,
        error: "Token expired",
      });

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    });

    it("should reject request with malformed token", async () => {
      mockRequest.headers = {
        authorization: "Bearer malformed.token.here",
      };

      const authService = Container.get(AuthService) as any;
      authService.verifyToken.mockRejectedValue(new Error("JWT malformed"));

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
        role: "admin",
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRequest.headers = {
        authorization: "Bearer valid-token-123",
      };

      const authService = Container.get(AuthService) as any;
      authService.verifyToken.mockResolvedValue({
        valid: true,
        payload: { userId: "user-123" },
      });
      authService.getUserFromToken.mockResolvedValue(mockUser);

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockRequest.user).toEqual(mockUser);
      expect(mockRequest.user?.id).toBe("user-123");
      expect(mockRequest.user?.email).toBe("test@example.com");
      expect(mockRequest.user?.role).toBe("admin");
    });

    it("should handle user not found scenario", async () => {
      mockRequest.headers = {
        authorization: "Bearer valid-token-but-user-deleted",
      };

      const authService = Container.get(AuthService) as any;
      authService.verifyToken.mockResolvedValue({
        valid: true,
        payload: { userId: "deleted-user" },
      });
      authService.getUserFromToken.mockResolvedValue(null);

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
      authService.verifyToken.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
    });

    it("should log service errors", async () => {
      mockRequest.headers = {
        authorization: "Bearer valid-token-123",
      };

      const authService = Container.get(AuthService) as any;
      const loggerService = Container.get(LoggerService) as any;

      const serviceError = new Error("Service unavailable");
      authService.verifyToken.mockRejectedValue(serviceError);

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(loggerService.error).toHaveBeenCalledWith(
        "Authentication error",
        expect.objectContaining({
          error: serviceError.message,
          path: "/test",
          method: "GET",
        }),
      );
    });
  });

  describe("Token Formats", () => {
    it("should handle token with extra spaces", async () => {
      mockRequest.headers = {
        authorization: "  Bearer   valid-token-123  ",
      };

      const authService = Container.get(AuthService) as any;
      authService.verifyToken.mockResolvedValue({
        valid: true,
        payload: { userId: "user-123" },
      });
      authService.getUserFromToken.mockResolvedValue({
        id: "user-123",
        email: "test@example.com",
        role: "user",
      });

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(authService.verifyToken).toHaveBeenCalledWith("valid-token-123");
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it("should handle case-insensitive Bearer keyword", async () => {
      mockRequest.headers = {
        authorization: "bearer valid-token-123",
      };

      const authService = Container.get(AuthService) as any;
      authService.verifyToken.mockResolvedValue({
        valid: true,
        payload: { userId: "user-123" },
      });
      authService.getUserFromToken.mockResolvedValue({
        id: "user-123",
        email: "test@example.com",
        role: "user",
      });

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(authService.verifyToken).toHaveBeenCalledWith("valid-token-123");
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });

  describe("Performance", () => {
    it("should not block on concurrent requests", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        role: "user",
      };

      // Create multiple concurrent requests
      const requests = Array(5)
        .fill(null)
        .map((_, index) => {
          const req = {
            headers: { authorization: `Bearer token-${index}` },
            path: `/test-${index}`,
            method: "GET",
          };
          const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
          const next = vi.fn();
          return { req, res, next };
        });

      const authService = Container.get(AuthService) as any;
      authService.verifyToken.mockResolvedValue({
        valid: true,
        payload: { userId: "user-123" },
      });
      authService.getUserFromToken.mockResolvedValue(mockUser);

      // Execute all requests concurrently
      const startTime = Date.now();
      await Promise.all(
        requests.map(({ req, res, next }) =>
          authMiddleware.use(req as Request, res as Response, next),
        ),
      );
      const endTime = Date.now();

      // Should complete quickly (under 100ms for all 5 requests)
      expect(endTime - startTime).toBeLessThan(100);

      // All should succeed
      requests.forEach(({ next }) => {
        expect(next).toHaveBeenCalledWith();
      });
    });
  });
});
