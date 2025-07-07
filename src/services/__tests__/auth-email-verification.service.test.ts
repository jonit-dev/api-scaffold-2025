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
  hash: vi.fn().mockResolvedValue("hashed-password"),
  compare: vi.fn().mockResolvedValue(true),
}));

// Mock jwt
vi.mock("jsonwebtoken", () => ({
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

      // Act & Assert
      await expect(authService.login(loginDto)).rejects.toThrow(
        "Account is not active",
      );
    });
  });

  describe("Email verification process", () => {
    it("should update user status to Active when email is verified", async () => {
      // Arrange
      const mockToken = "valid-verification-token";
      const mockPayload = {
        email: "test@example.com",
        type: "verification",
      };

      userRepository.findByEmail = vi.fn().mockResolvedValue({
        ...mockUser,
        status: UserStatus.PendingVerification,
      });

      userRepository.updateStatus = vi.fn().mockResolvedValue(undefined);

      // Act
      const result = await authService.verifyEmail(mockToken);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe("Email verified successfully");
      expect(userRepository.updateStatus).toHaveBeenCalledWith(
        mockUser.id,
        UserStatus.Active,
      );
    });
  });
});
