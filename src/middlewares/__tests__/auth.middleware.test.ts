import { describe, it, expect, beforeEach, vi } from "vitest";
import { Container } from "typedi";
import { AuthMiddleware } from "@middlewares/auth.middleware";
import { AuthService } from "@services/auth.service";
import { UnauthorizedException } from "@exceptions/http-exceptions";
import { TestHelpers } from "@tests/utils/test.helpers";
import { AuthFactory } from "@tests/factories/auth.factory";
import { UserRole } from "../../models/enums/user-roles.enum";
import { UserStatus } from "../../models/enums/user-status.enum";

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
      "verifyUser",
    ]);

    // Create mock Supabase client (required for constructor but not used in new implementation)
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
      const userProfile = AuthFactory.createTestUser();

      mockRequest.headers.authorization = `Bearer ${token}`;
      (mockAuthService.verifyUser as any).mockResolvedValue(userProfile);

      await authMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockRequest.user).toEqual({
        id: userProfile.id,
        email: userProfile.email,
        role: userProfile.role,
      });
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockAuthService.verifyUser).toHaveBeenCalledWith(token);
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

    it("should throw UnauthorizedException when AuthService throws error", async () => {
      const token = AuthFactory.createExpiredJwtToken();
      mockRequest.headers.authorization = `Bearer ${token}`;

      (mockAuthService.verifyUser as any).mockRejectedValue(
        new Error("Token expired"),
      );

      await authMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockNext.mock.calls[0][0].message).toBe("Authentication failed");
    });

    it("should throw UnauthorizedException when AuthService returns no user", async () => {
      const token = AuthFactory.createInvalidJwtToken();
      mockRequest.headers.authorization = `Bearer ${token}`;

      (mockAuthService.verifyUser as any).mockRejectedValue(
        new Error("User not found"),
      );

      await authMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockNext.mock.calls[0][0].message).toBe("Authentication failed");
    });

    it("should throw UnauthorizedException when user profile not found", async () => {
      const token = AuthFactory.createValidJwtToken();

      mockRequest.headers.authorization = `Bearer ${token}`;
      (mockAuthService.verifyUser as any).mockRejectedValue(
        new Error("User profile not found"),
      );

      await authMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockNext.mock.calls[0][0].message).toBe("Authentication failed");
    });

    it("should handle unexpected errors gracefully", async () => {
      const token = AuthFactory.createValidJwtToken();
      mockRequest.headers.authorization = `Bearer ${token}`;

      (mockAuthService.verifyUser as any).mockRejectedValue(
        new Error("Network error"),
      );

      await authMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockNext.mock.calls[0][0].message).toBe("Authentication failed");
    });

    it("should handle case-insensitive Bearer token", async () => {
      const token = AuthFactory.createValidJwtToken();
      const userProfile = AuthFactory.createTestUser();

      mockRequest.headers.authorization = `bearer ${token}`; // lowercase bearer
      (mockAuthService.verifyUser as any).mockResolvedValue(userProfile);

      await authMiddleware.use(mockRequest, mockResponse, mockNext);

      // Should succeed because auth.utils.extractBearerToken handles case-insensitive
      expect(mockRequest.user).toEqual({
        id: userProfile.id,
        email: userProfile.email,
        role: userProfile.role,
      });
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockAuthService.verifyUser).toHaveBeenCalledWith(token);
    });

    it("should handle authorization header with extra spaces", async () => {
      const token = AuthFactory.createValidJwtToken();
      const userProfile = AuthFactory.createTestUser();

      mockRequest.headers.authorization = `Bearer  ${token}  `; // Extra spaces
      (mockAuthService.verifyUser as any).mockResolvedValue(userProfile);

      await authMiddleware.use(mockRequest, mockResponse, mockNext);

      // Should succeed because auth.utils.extractBearerToken handles extra spaces
      expect(mockRequest.user).toEqual({
        id: userProfile.id,
        email: userProfile.email,
        role: userProfile.role,
      });
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockAuthService.verifyUser).toHaveBeenCalledWith(token);
    });

    it("should propagate UnauthorizedException without wrapping", async () => {
      const token = AuthFactory.createValidJwtToken();
      const originalError = new UnauthorizedException("Custom auth error");

      mockRequest.headers.authorization = `Bearer ${token}`;
      (mockAuthService.verifyUser as any).mockRejectedValue(originalError);

      await authMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(originalError);
    });
  });
});
