import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuthController } from "../../../src/controllers/auth.controller";
import { AuthService } from "../../../src/services/auth.service";
import { UserRole, UserStatus } from "../../../src/models/enums";
import { AuthFactory } from "../../factories/auth.factory";
import { TestHelpers } from "../../utils/test.helpers";
import {
  AuthException,
  InvalidCredentialsException,
  UserNotFoundException,
} from "../../../src/exceptions/auth.exception";

describe("AuthController", () => {
  let authController: AuthController;
  let mockAuthService: AuthService;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    // Create mock auth service
    mockAuthService = TestHelpers.createMockService<AuthService>([
      "register",
      "login",
      "logout",
      "refreshToken",
      "forgotPassword",
      "changePassword",
      "verifyEmail",
      "resendVerification",
      "getCurrentUser",
      "verifyUser",
    ]);

    // Create controller with mocked service
    authController = new AuthController(mockAuthService);

    // Create mock request and response
    mockRequest = {
      headers: {
        authorization: "Bearer valid-token-123",
      },
      user: AuthFactory.createAuthenticatedUser(),
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe("register", () => {
    it("should register a new user successfully", async () => {
      const registerDto = AuthFactory.createRegisterDto();
      const expectedResponse = AuthFactory.createAuthResponseDto();

      (mockAuthService.register as any).mockResolvedValue(expectedResponse);

      const result = await authController.register(registerDto);

      expect(result).toEqual(expectedResponse);
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
    });

    it("should throw AuthException for invalid registration data", async () => {
      const registerDto = AuthFactory.createRegisterDto({
        password: "weak",
        confirmPassword: "different",
      });

      (mockAuthService.register as any).mockRejectedValue(
        new AuthException("Passwords do not match", 400)
      );

      await expect(authController.register(registerDto)).rejects.toThrow(
        AuthException
      );
    });

    it("should throw AuthException for existing email", async () => {
      const registerDto = AuthFactory.createRegisterDto();

      (mockAuthService.register as any).mockRejectedValue(
        new AuthException("Email already registered", 409)
      );

      await expect(authController.register(registerDto)).rejects.toThrow(
        AuthException
      );
    });
  });

  describe("login", () => {
    it("should login user successfully", async () => {
      const loginDto = AuthFactory.createLoginDto();
      const expectedResponse = AuthFactory.createAuthResponseDto();

      (mockAuthService.login as any).mockResolvedValue(expectedResponse);

      const result = await authController.login(loginDto);

      expect(result).toEqual(expectedResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
    });

    it("should throw InvalidCredentialsException for invalid credentials", async () => {
      const loginDto = AuthFactory.createLoginDto({
        email: "test@example.com",
        password: "wrongpassword",
      });

      (mockAuthService.login as any).mockRejectedValue(
        new InvalidCredentialsException()
      );

      await expect(authController.login(loginDto)).rejects.toThrow(
        InvalidCredentialsException
      );
    });

    it("should throw UserNotFoundException for non-existent user", async () => {
      const loginDto = AuthFactory.createLoginDto();

      (mockAuthService.login as any).mockRejectedValue(
        new UserNotFoundException()
      );

      await expect(authController.login(loginDto)).rejects.toThrow(
        UserNotFoundException
      );
    });
  });

  describe("logout", () => {
    it("should logout user successfully", async () => {
      (mockAuthService.logout as any).mockResolvedValue(undefined);

      await authController.logout(mockRequest);

      expect(mockAuthService.logout).toHaveBeenCalledWith("valid-token-123");
    });

    it("should throw error when no authorization header", async () => {
      const requestWithoutAuth = { headers: {}, user: mockRequest.user };

      await expect(authController.logout(requestWithoutAuth)).rejects.toThrow(
        "No authorization header found"
      );
    });

    it("should throw error when invalid authorization format", async () => {
      const requestWithInvalidAuth = {
        headers: { authorization: "InvalidFormat" },
        user: mockRequest.user,
      };

      await expect(
        authController.logout(requestWithInvalidAuth)
      ).rejects.toThrow("Invalid authorization format");
    });
  });

  describe("refreshToken", () => {
    it("should refresh token successfully", async () => {
      const refreshTokenDto = { refresh_token: "refresh-token-123" };
      const expectedResponse = AuthFactory.createAuthResponseDto();

      (mockAuthService.refreshToken as any).mockResolvedValue(expectedResponse);

      const result = await authController.refreshToken(refreshTokenDto);

      expect(result).toEqual(expectedResponse);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        refreshTokenDto
      );
    });

    it("should throw AuthException for invalid refresh token", async () => {
      const refreshTokenDto = { refresh_token: "invalid-token" };

      (mockAuthService.refreshToken as any).mockRejectedValue(
        new AuthException("Token refresh failed", 401)
      );

      await expect(
        authController.refreshToken(refreshTokenDto)
      ).rejects.toThrow(AuthException);
    });
  });

  describe("forgotPassword", () => {
    it("should send forgot password email successfully", async () => {
      const forgotPasswordDto = { email: "test@example.com" };

      (mockAuthService.forgotPassword as any).mockResolvedValue(undefined);

      const result = await authController.forgotPassword(forgotPasswordDto);

      expect(result).toEqual({
        message: "Password reset email sent successfully",
      });
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(
        forgotPasswordDto.email
      );
    });

    it("should throw AuthException when email sending fails", async () => {
      const forgotPasswordDto = { email: "test@example.com" };

      (mockAuthService.forgotPassword as any).mockRejectedValue(
        new AuthException("Password reset request failed", 500)
      );

      await expect(
        authController.forgotPassword(forgotPasswordDto)
      ).rejects.toThrow(AuthException);
    });
  });

  describe("changePassword", () => {
    it("should change password successfully", async () => {
      const changePasswordDto = {
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      };

      (mockAuthService.changePassword as any).mockResolvedValue(undefined);

      const result = await authController.changePassword(
        changePasswordDto,
        mockRequest
      );

      expect(result).toEqual({ message: "Password changed successfully" });
      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        mockRequest.user.id,
        changePasswordDto
      );
    });

    it("should throw AuthException for mismatched passwords", async () => {
      const changePasswordDto = {
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword123!",
        confirmPassword: "DifferentPassword123!",
      };

      (mockAuthService.changePassword as any).mockRejectedValue(
        new AuthException("Passwords do not match", 400)
      );

      await expect(
        authController.changePassword(changePasswordDto, mockRequest)
      ).rejects.toThrow(AuthException);
    });
  });

  describe("verifyEmail", () => {
    it("should verify email successfully", async () => {
      const verifyEmailDto = { token: "verification-token-123" };

      (mockAuthService.verifyEmail as any).mockResolvedValue(undefined);

      const result = await authController.verifyEmail(verifyEmailDto);

      expect(result).toEqual({ message: "Email verified successfully" });
      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith(
        verifyEmailDto.token
      );
    });

    it("should throw AuthException for invalid token", async () => {
      const verifyEmailDto = { token: "invalid-token" };

      (mockAuthService.verifyEmail as any).mockRejectedValue(
        new AuthException("Email verification failed", 400)
      );

      await expect(authController.verifyEmail(verifyEmailDto)).rejects.toThrow(
        AuthException
      );
    });
  });

  describe("resendVerification", () => {
    it("should resend verification email successfully", async () => {
      const resendVerificationDto = { email: "test@example.com" };

      (mockAuthService.resendVerification as any).mockResolvedValue(undefined);

      const result = await authController.resendVerification(
        resendVerificationDto
      );

      expect(result).toEqual({
        message: "Verification email sent successfully",
      });
      expect(mockAuthService.resendVerification).toHaveBeenCalledWith(
        resendVerificationDto.email
      );
    });

    it("should throw AuthException when resend fails", async () => {
      const resendVerificationDto = { email: "test@example.com" };

      (mockAuthService.resendVerification as any).mockRejectedValue(
        new AuthException("Verification email resend failed", 400)
      );

      await expect(
        authController.resendVerification(resendVerificationDto)
      ).rejects.toThrow(AuthException);
    });
  });

  describe("getCurrentUser", () => {
    it("should get current user successfully", async () => {
      const expectedUser = {
        id: "user-123",
        email: "test@example.com",
        first_name: "Test",
        last_name: "User",
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        email_verified: true,
        phone: "+1234567890",
        avatar_url: "https://example.com/avatar.jpg",
        last_login: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        full_name: "Test User",
      };

      (mockAuthService.getCurrentUser as any).mockResolvedValue(expectedUser);

      const result = await authController.getCurrentUser(mockRequest);

      expect(result).toEqual(expectedUser);
      expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith(
        mockRequest.user.id
      );
    });

    it("should throw UserNotFoundException when user not found", async () => {
      (mockAuthService.getCurrentUser as any).mockRejectedValue(
        new UserNotFoundException()
      );

      await expect(authController.getCurrentUser(mockRequest)).rejects.toThrow(
        UserNotFoundException
      );
    });
  });

  describe("verifyToken", () => {
    it("should verify token successfully", async () => {
      const expectedUser = {
        id: "user-123",
        email: "test@example.com",
        first_name: "Test",
        last_name: "User",
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        email_verified: true,
        phone: "+1234567890",
        avatar_url: "https://example.com/avatar.jpg",
        last_login: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        full_name: "Test User",
      };

      (mockAuthService.verifyUser as any).mockResolvedValue(expectedUser);

      const result = await authController.verifyToken(mockRequest);

      expect(result).toEqual({ valid: true, user: expectedUser });
      expect(mockAuthService.verifyUser).toHaveBeenCalledWith(
        "valid-token-123"
      );
    });

    it("should return invalid for invalid token", async () => {
      (mockAuthService.verifyUser as any).mockRejectedValue(
        new AuthException("Invalid token", 401)
      );

      const result = await authController.verifyToken(mockRequest);

      expect(result).toEqual({ valid: false });
    });

    it("should return invalid when no token provided", async () => {
      const requestWithoutToken = { headers: {} };

      const result = await authController.verifyToken(requestWithoutToken);

      expect(result).toEqual({ valid: false });
    });
  });

  describe("healthCheck", () => {
    it("should return health status", async () => {
      const result = await authController.healthCheck();

      expect(result).toHaveProperty("status", "healthy");
      expect(result).toHaveProperty("timestamp");
      expect(typeof result.timestamp).toBe("string");
    });
  });

  describe("extractTokenFromRequest", () => {
    it("should extract token from valid Bearer authorization header", () => {
      const request = {
        headers: { authorization: "Bearer valid-token-123" },
      };

      const token = (authController as any).extractTokenFromRequest(request);

      expect(token).toBe("valid-token-123");
    });

    it("should throw error when no authorization header", () => {
      const request = { headers: {} };

      expect(() => {
        (authController as any).extractTokenFromRequest(request);
      }).toThrow("No authorization header found");
    });

    it("should throw error when invalid authorization format", () => {
      const request = {
        headers: { authorization: "InvalidFormat" },
      };

      expect(() => {
        (authController as any).extractTokenFromRequest(request);
      }).toThrow("Invalid authorization format");
    });

    it("should throw error when missing token", () => {
      const request = {
        headers: { authorization: "Bearer " },
      };

      expect(() => {
        (authController as any).extractTokenFromRequest(request);
      }).toThrow("Invalid authorization format");
    });
  });
});
