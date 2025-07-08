import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuthService } from "../auth.service";
import { UserRepository } from "../../repositories/user.repository";
import { EmailService } from "../email.service";
import { LoggerService } from "../logger.service";
import { UserRole } from "../../models/enums/user-roles.enum";
import { UserStatus } from "../../models/enums/user-status.enum";
import { config } from "../../config/env";

// Mock bcrypt
vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password"),
    compare: vi.fn().mockResolvedValue(true),
  },
  hash: vi.fn().mockResolvedValue("hashed-password"),
  compare: vi.fn().mockResolvedValue(true),
}));

// Mock jwt
vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn().mockReturnValue("mock-jwt-token"),
    verify: vi.fn().mockReturnValue({
      email: "test@example.com",
      type: "verification",
    }),
  },
  sign: vi.fn().mockReturnValue("mock-jwt-token"),
  verify: vi.fn().mockReturnValue({
    email: "test@example.com",
    type: "verification",
  }),
}));

describe("AuthService - Email Verification Feature", () => {
  let authService: AuthService;
  let userRepository: UserRepository;
  let emailService: EmailService;
  let loggerService: LoggerService;

  const mockUser = {
    id: "test-user-id",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    passwordHash: "hashed-password",
    role: UserRole.User,
    status: UserStatus.Active,
    emailUnsubscribed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(() => {
    // Create mocks
    userRepository = {
      findByEmail: vi.fn(),
      create: vi.fn(),
      updateLastLogin: vi.fn(),
      findById: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as UserRepository;

    emailService = {
      sendWithTemplate: vi.fn(),
    } as unknown as EmailService;

    loggerService = {
      info: vi.fn(),
      error: vi.fn(),
    } as unknown as LoggerService;

    authService = new AuthService(userRepository, emailService, loggerService);

    vi.clearAllMocks();
  });

  describe("Registration with REQUIRE_EMAIL_VERIFICATION=false", () => {
    it("should create user with Active status when email verification is disabled", async () => {
      // Arrange
      const originalConfig = config.auth.requireEmailVerification;

      (config.auth as any).requireEmailVerification = false;

      const registerDto = {
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        password: "password123",
        confirmPassword: "password123",
      };

      userRepository.findByEmail = vi.fn().mockResolvedValue(null);
      userRepository.create = vi.fn().mockResolvedValue({
        ...mockUser,
        status: UserStatus.Active,
      });

      // Act
      const result = await authService.register(registerDto);

      // Assert
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: registerDto.email,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          role: UserRole.User,
          status: UserStatus.Active, // Should be Active when verification is disabled
          emailUnsubscribed: false,
        }),
      );

      expect(emailService.sendWithTemplate).not.toHaveBeenCalled();
      expect(loggerService.info).toHaveBeenCalledWith(
        "User registered and auto-verified (email verification disabled):",
        {
          userId: mockUser.id,
          email: mockUser.email,
        },
      );

      expect(result.user).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.session?.access_token).toBeDefined();

      // Restore original config

      (config.auth as any).requireEmailVerification = originalConfig;
    });

    it("should not send verification email when email verification is disabled", async () => {
      // Arrange
      const originalConfig = config.auth.requireEmailVerification;

      (config.auth as any).requireEmailVerification = false;

      const registerDto = {
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        password: "password123",
        confirmPassword: "password123",
      };

      userRepository.findByEmail = vi.fn().mockResolvedValue(null);
      userRepository.create = vi.fn().mockResolvedValue({
        ...mockUser,
        status: UserStatus.Active,
      });

      // Act
      await authService.register(registerDto);

      // Assert
      expect(emailService.sendWithTemplate).not.toHaveBeenCalled();

      // Restore original config

      (config.auth as any).requireEmailVerification = originalConfig;
    });
  });

  describe("Registration with REQUIRE_EMAIL_VERIFICATION=true", () => {
    it("should create user with PendingVerification status when email verification is enabled", async () => {
      // Arrange
      const originalConfig = config.auth.requireEmailVerification;

      (config.auth as any).requireEmailVerification = true;

      const registerDto = {
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        password: "password123",
        confirmPassword: "password123",
      };

      userRepository.findByEmail = vi.fn().mockResolvedValue(null);
      userRepository.create = vi.fn().mockResolvedValue({
        ...mockUser,
        status: UserStatus.PendingVerification,
      });

      emailService.sendWithTemplate = vi
        .fn()
        .mockResolvedValue({ success: true });

      // Act
      const result = await authService.register(registerDto);

      // Assert
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: registerDto.email,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          role: UserRole.User,
          status: UserStatus.PendingVerification, // Should be PendingVerification when verification is enabled
          emailUnsubscribed: false,
        }),
      );

      expect(emailService.sendWithTemplate).toHaveBeenCalledWith(
        "welcome",
        expect.objectContaining({
          firstName: registerDto.firstName,
          appName: expect.any(String),
          verificationUrl: expect.stringContaining("/auth/verify-email?token="),
          currentYear: expect.any(Number),
        }),
        {
          to: registerDto.email,
          subject: "Welcome! Please verify your account",
        },
      );

      expect(result.user).toBeDefined();
      expect(result.session).toBeDefined();

      // Restore original config

      (config.auth as any).requireEmailVerification = originalConfig;
    });

    it("should send verification email when email verification is enabled", async () => {
      // Arrange
      const originalConfig = config.auth.requireEmailVerification;

      (config.auth as any).requireEmailVerification = true;

      const registerDto = {
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        password: "password123",
        confirmPassword: "password123",
      };

      userRepository.findByEmail = vi.fn().mockResolvedValue(null);
      userRepository.create = vi.fn().mockResolvedValue({
        ...mockUser,
        status: UserStatus.PendingVerification,
      });

      emailService.sendWithTemplate = vi
        .fn()
        .mockResolvedValue({ success: true });

      // Act
      await authService.register(registerDto);

      // Assert
      expect(emailService.sendWithTemplate).toHaveBeenCalledTimes(1);
      expect(emailService.sendWithTemplate).toHaveBeenCalledWith(
        "welcome",
        expect.any(Object),
        expect.objectContaining({
          to: registerDto.email,
          subject: "Welcome! Please verify your account",
        }),
      );

      // Restore original config

      (config.auth as any).requireEmailVerification = originalConfig;
    });

    it("should handle email sending failure gracefully", async () => {
      // Arrange
      const originalConfig = config.auth.requireEmailVerification;

      (config.auth as any).requireEmailVerification = true;

      const registerDto = {
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        password: "password123",
        confirmPassword: "password123",
      };

      userRepository.findByEmail = vi.fn().mockResolvedValue(null);
      userRepository.create = vi.fn().mockResolvedValue({
        ...mockUser,
        status: UserStatus.PendingVerification,
      });

      emailService.sendWithTemplate = vi
        .fn()
        .mockRejectedValue(new Error("Email service error"));

      // Act
      const result = await authService.register(registerDto);

      // Assert
      expect(result.user).toBeDefined();
      expect(result.session).toBeDefined();
      expect(loggerService.error).toHaveBeenCalledWith(
        "Failed to send welcome email:",
        expect.objectContaining({
          error: "Error: Email service error",
        }),
      );

      // Restore original config

      (config.auth as any).requireEmailVerification = originalConfig;
    });
  });

  describe("Login behavior with different user statuses", () => {
    it("should allow login for Active users", async () => {
      // Arrange
      const loginDto = {
        email: "test@example.com",
        password: "password123",
      };

      userRepository.findByEmail = vi.fn().mockResolvedValue({
        ...mockUser,
        status: UserStatus.Active,
      });

      userRepository.updateLastLogin = vi.fn().mockResolvedValue(undefined);

      // Mock the verifyPassword method to return true
      vi.spyOn(authService as any, "verifyPassword").mockResolvedValue(true);

      // Act
      const result = await authService.login(loginDto);

      // Assert
      expect(result.user).toBeDefined();
      expect(result.session).toBeDefined();
      expect(userRepository.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
    });

    it("should prevent login for PendingVerification users", async () => {
      // Arrange
      const loginDto = {
        email: "test@example.com",
        password: "password123",
      };

      userRepository.findByEmail = vi.fn().mockResolvedValue({
        ...mockUser,
        status: UserStatus.PendingVerification,
      });

      // Mock the verifyPassword method to return true
      vi.spyOn(authService as any, "verifyPassword").mockResolvedValue(true);

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toThrow(
        "Account is not active",
      );
    });
  });

  describe("Email verification process", () => {
    it("should handle email verification", async () => {
      // Arrange
      const token = "mock-jwt-token";

      // Act & Assert - Just ensure the method can be called without throwing
      const result = await authService.verifyEmail(token);

      // Should return a result object with success and message properties
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("message");
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.message).toBe("string");
    });

    it("should return failure for invalid token", async () => {
      // Arrange
      const token = "invalid-token";

      // Mock jwt.verify to throw an error
      const jwt = await import("jsonwebtoken");
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error("Invalid token");
      });

      // Act
      const result = await authService.verifyEmail(token);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe("Invalid or expired verification token");
    });

    it("should return failure for user not found", async () => {
      // Arrange
      const token = "mock-jwt-token";
      const decodedToken = {
        email: "nonexistent@example.com",
        type: "verification",
      };

      userRepository.findByEmail = vi.fn().mockResolvedValue(null);

      // Mock jwt.verify to return the decoded token
      const jwt = await import("jsonwebtoken");
      vi.mocked(jwt.verify).mockReturnValue(decodedToken as any);

      // Act
      const result = await authService.verifyEmail(token);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe("Invalid or expired verification token");
    });
  });
});
