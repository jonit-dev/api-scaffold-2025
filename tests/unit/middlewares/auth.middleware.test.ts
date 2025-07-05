import { describe, it, expect, beforeEach, vi } from "vitest";
import { Container } from "typedi";
import { AuthMiddleware } from "../../../src/middlewares/auth.middleware";
import { AuthService } from "@services/auth.service";
import { UnauthorizedException } from "@exceptions/http-exceptions";
import { TestHelpers } from "../../utils/test.helpers";
import { AuthFactory } from "../../factories/auth.factory";

describe("AuthMiddleware", () => {
  let authMiddleware: AuthMiddleware;
  let mockAuthService: AuthService;
  let mockSupabaseAuth: any;
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: any;

  beforeEach(() => {
    // Create mock services
    mockAuthService = TestHelpers.createMockService<AuthService>([
      "getUserProfile",
    ]);

    // Create mock Supabase client
    mockSupabaseAuth = {
      auth: {
        getUser: vi.fn(),
      },
    };

    // Create mock Express objects
    mockRequest = {
      headers: {},
      user: undefined,
    };
    mockResponse = AuthFactory.createMockResponse();
    mockNext = AuthFactory.createMockNext();

    // Register mocks in container
    Container.set("supabaseAuth", mockSupabaseAuth);
    Container.set(AuthService, mockAuthService);

    authMiddleware = new AuthMiddleware(mockAuthService, mockSupabaseAuth);
  });

  describe("use", () => {
    it("should authenticate user with valid token", async () => {
      const token = AuthFactory.createValidJwtToken();
      const supabaseUser = AuthFactory.createSupabaseUser();
      const userProfile = AuthFactory.createTestUser();

      mockRequest.headers.authorization = `Bearer ${token}`;
      mockSupabaseAuth.auth.getUser.mockResolvedValue({
        data: { user: supabaseUser },
        error: null,
      });
      (mockAuthService.getUserProfile as any).mockResolvedValue(userProfile);

      await authMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockRequest.user).toEqual({
        id: supabaseUser.id,
        email: supabaseUser.email,
        role: userProfile.role,
        supabaseUser,
      });
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockSupabaseAuth.auth.getUser).toHaveBeenCalledWith(token);
      expect(mockAuthService.getUserProfile).toHaveBeenCalledWith(
        supabaseUser.id,
      );
    });

    it("should throw UnauthorizedException when no token provided", async () => {
      mockRequest.headers.authorization = undefined;

      await authMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockNext.mock.calls[0][0].message).toBe("Access token required");
    });

    it("should throw UnauthorizedException when token format is invalid", async () => {
      mockRequest.headers.authorization = "InvalidTokenFormat";

      await authMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockNext.mock.calls[0][0].message).toBe("Access token required");
    });

    it("should throw UnauthorizedException when Bearer prefix is missing", async () => {
      const token = AuthFactory.createValidJwtToken();
      mockRequest.headers.authorization = token; // Missing "Bearer " prefix

      await authMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockNext.mock.calls[0][0].message).toBe("Access token required");
    });

    it("should throw UnauthorizedException when Supabase returns error", async () => {
      const token = AuthFactory.createExpiredJwtToken();
      mockRequest.headers.authorization = `Bearer ${token}`;

      mockSupabaseAuth.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Token expired" },
      });

      await authMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockNext.mock.calls[0][0].message).toBe(
        "Invalid or expired token",
      );
    });

    it("should throw UnauthorizedException when Supabase returns no user", async () => {
      const token = AuthFactory.createInvalidJwtToken();
      mockRequest.headers.authorization = `Bearer ${token}`;

      mockSupabaseAuth.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await authMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockNext.mock.calls[0][0].message).toBe(
        "Invalid or expired token",
      );
    });

    it("should throw UnauthorizedException when user profile not found", async () => {
      const token = AuthFactory.createValidJwtToken();
      const supabaseUser = AuthFactory.createSupabaseUser();

      mockRequest.headers.authorization = `Bearer ${token}`;
      mockSupabaseAuth.auth.getUser.mockResolvedValue({
        data: { user: supabaseUser },
        error: null,
      });
      (mockAuthService.getUserProfile as any).mockRejectedValue(
        new Error("User profile not found"),
      );

      await authMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockNext.mock.calls[0][0].message).toBe("Authentication failed");
    });

    it("should handle unexpected errors gracefully", async () => {
      const token = AuthFactory.createValidJwtToken();
      mockRequest.headers.authorization = `Bearer ${token}`;

      mockSupabaseAuth.auth.getUser.mockRejectedValue(
        new Error("Network error"),
      );

      await authMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockNext.mock.calls[0][0].message).toBe("Authentication failed");
    });

    it("should handle case-insensitive Bearer token", async () => {
      const token = AuthFactory.createValidJwtToken();
      const supabaseUser = AuthFactory.createSupabaseUser();
      const userProfile = AuthFactory.createTestUser();

      mockRequest.headers.authorization = `bearer ${token}`; // lowercase bearer
      mockSupabaseAuth.auth.getUser.mockResolvedValue({
        data: { user: supabaseUser },
        error: null,
      });
      (mockAuthService.getUserProfile as any).mockResolvedValue(userProfile);

      await authMiddleware.use(mockRequest, mockResponse, mockNext);

      // Should fail because we only accept "Bearer" with capital B
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockNext.mock.calls[0][0].message).toBe("Access token required");
    });

    it("should handle authorization header with extra spaces", async () => {
      const token = AuthFactory.createValidJwtToken();
      mockRequest.headers.authorization = `Bearer  ${token}  `; // Extra spaces

      await authMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockNext.mock.calls[0][0].message).toBe("Access token required");
    });

    it("should propagate UnauthorizedException without wrapping", async () => {
      const token = AuthFactory.createValidJwtToken();
      const originalError = new UnauthorizedException("Custom auth error");

      mockRequest.headers.authorization = `Bearer ${token}`;
      mockSupabaseAuth.auth.getUser.mockRejectedValue(originalError);

      await authMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(originalError);
    });
  });

  // Note: extractTokenFromHeader functionality is tested through the auth.utils module
  // The AuthMiddleware uses the extractBearerToken utility function from auth.utils
});
