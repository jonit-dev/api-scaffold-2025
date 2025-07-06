import { Container } from "typedi";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as bcrypt from "bcrypt";

import {
  AuthException,
  InvalidCredentialsException,
  UserNotFoundException,
} from "@exceptions/auth.exception";
import { UserRepository } from "@repositories/user.repository";
import { AuthFactory } from "@tests/factories/auth.factory";
import { TestHelpers } from "@tests/utils/test.helpers";
import { AuthService } from "../auth.service";
import { config } from "../../config/env";
import { HttpStatus } from "../../types/http-status";

// Mock bcrypt module
vi.mock("bcrypt", () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

describe("AuthService - Change Password", () => {
  let authService: AuthService;
  let mockUserRepository: UserRepository;
  let mockSupabaseAuth: any;
  let mockSupabaseAdmin: any;

  beforeEach(() => {
    // Create mock repositories
    mockUserRepository = TestHelpers.createMockRepository<UserRepository>([
      "findById",
      "updatePassword",
    ]);

    // Create mock Supabase clients
    mockSupabaseAuth = {
      auth: {
        updateUser: vi.fn(),
      },
    };

    mockSupabaseAdmin = {
      auth: {
        updateUser: vi.fn(),
      },
    };

    // Register mocks in container
    Container.set("supabaseAuth", mockSupabaseAuth);
    Container.set("supabaseAdmin", mockSupabaseAdmin);
    Container.set(UserRepository, mockUserRepository);

    authService = new AuthService(
      mockUserRepository,
      mockSupabaseAuth,
      mockSupabaseAdmin,
    );
  });

  describe("SQLite Provider", () => {
    beforeEach(() => {
      // Force AuthService to use SQLite for these tests
      vi.spyOn(config.database, "provider", "get").mockReturnValue("sqlite");
    });

    it("should change password successfully with SQLite", async () => {
      const userId = "user-id-123";
      const changePasswordDto = {
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      };

      const mockUser = AuthFactory.createTestUser({
        id: userId,
        passwordHash: "$2b$10$hashedOldPassword",
      });

      // Mock repository calls
      (mockUserRepository.findById as any).mockResolvedValue(mockUser);
      (mockUserRepository.updatePassword as any).mockResolvedValue(undefined);

      // Mock bcrypt comparison to return true for correct password
      (bcrypt.compare as any).mockResolvedValue(true);
      (bcrypt.hash as any).mockResolvedValue("$2b$10$hashedNewPassword");

      await authService.changePassword(userId, changePasswordDto);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        changePasswordDto.currentPassword,
        mockUser.passwordHash,
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(
        changePasswordDto.newPassword,
        4, // BCRYPT_ROUNDS is set to 4 in test environment
      );
      expect(mockUserRepository.updatePassword).toHaveBeenCalledWith(
        userId,
        "$2b$10$hashedNewPassword",
      );
    });

    it("should throw error when user not found with SQLite", async () => {
      const userId = "nonexistent-user";
      const changePasswordDto = {
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      };

      (mockUserRepository.findById as any).mockResolvedValue(null);

      await expect(
        authService.changePassword(userId, changePasswordDto),
      ).rejects.toThrow(new UserNotFoundException("User not found"));

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockUserRepository.updatePassword).not.toHaveBeenCalled();
    });

    it("should throw error when current password is incorrect with SQLite", async () => {
      const userId = "user-id-123";
      const changePasswordDto = {
        currentPassword: "WrongPassword123!",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      };

      const mockUser = AuthFactory.createTestUser({
        id: userId,
        passwordHash: "$2b$10$hashedOldPassword",
      });

      (mockUserRepository.findById as any).mockResolvedValue(mockUser);

      // Mock bcrypt comparison to return false for incorrect password
      (bcrypt.compare as any).mockResolvedValue(false);

      await expect(
        authService.changePassword(userId, changePasswordDto),
      ).rejects.toThrow(
        new InvalidCredentialsException("Current password is incorrect"),
      );

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        changePasswordDto.currentPassword,
        mockUser.passwordHash,
      );
      expect(mockUserRepository.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe("Supabase Provider", () => {
    beforeEach(() => {
      // Force AuthService to use Supabase for these tests
      vi.spyOn(config.database, "provider", "get").mockReturnValue("supabase");
    });

    it("should change password successfully with Supabase", async () => {
      const userId = "user-id-123";
      const changePasswordDto = {
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      };

      mockSupabaseAuth.auth.updateUser.mockResolvedValue({ error: null });

      await authService.changePassword(userId, changePasswordDto);

      expect(mockSupabaseAuth.auth.updateUser).toHaveBeenCalledWith({
        password: changePasswordDto.newPassword,
      });
    });

    it("should throw error when Supabase password update fails", async () => {
      const userId = "user-id-123";
      const changePasswordDto = {
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      };

      mockSupabaseAuth.auth.updateUser.mockResolvedValue({
        error: { message: "Password update failed" },
      });

      await expect(
        authService.changePassword(userId, changePasswordDto),
      ).rejects.toThrow(
        new AuthException(
          "Password change failed",
          HttpStatus.InternalServerError,
        ),
      );

      expect(mockSupabaseAuth.auth.updateUser).toHaveBeenCalledWith({
        password: changePasswordDto.newPassword,
      });
    });

    it("should throw error when Supabase client is not configured", async () => {
      const userId = "user-id-123";
      const changePasswordDto = {
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      };

      // Create service without Supabase client
      const authServiceNoSupabase = new AuthService(
        mockUserRepository,
        undefined,
        undefined,
      );

      await expect(
        authServiceNoSupabase.changePassword(userId, changePasswordDto),
      ).rejects.toThrow(
        new AuthException(
          "Authentication service not configured",
          HttpStatus.InternalServerError,
        ),
      );
    });
  });

  describe("Common Validation", () => {
    it("should throw error when passwords don't match", async () => {
      const userId = "user-id-123";
      const changePasswordDto = {
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword123!",
        confirmPassword: "DifferentPassword123!",
      };

      await expect(
        authService.changePassword(userId, changePasswordDto),
      ).rejects.toThrow(
        new AuthException("Passwords do not match", HttpStatus.BadRequest),
      );
    });

    it("should handle unexpected errors gracefully", async () => {
      const userId = "user-id-123";
      const changePasswordDto = {
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      };

      // Force SQLite path and make repository throw unexpected error
      vi.spyOn(config.database, "provider", "get").mockReturnValue("sqlite");
      (mockUserRepository.findById as any).mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(
        authService.changePassword(userId, changePasswordDto),
      ).rejects.toThrow(
        new AuthException(
          "Password change failed",
          HttpStatus.InternalServerError,
        ),
      );
    });
  });
});
