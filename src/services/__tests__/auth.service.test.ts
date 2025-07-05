import { Container } from "typedi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AccountSuspendedException,
  AuthException,
  InvalidCredentialsException,
  UserNotFoundException,
} from "@exceptions/auth.exception";
import { UserRole } from "@models/enums/user-roles.enum";
import { UserStatus } from "@models/enums/user-status.enum";
import { UserRepository } from "@repositories/user.repository";
import { AuthFactory } from "@tests/factories/auth.factory";
import { TestHelpers } from "@tests/utils/test.helpers";
import { AuthService } from "../auth.service";

describe("AuthService", () => {
  let authService: AuthService;
  let mockUserRepository: UserRepository;
  let mockSupabaseAuth: any;
  let mockSupabaseAdmin: any;

  beforeEach(() => {
    // Create mock repositories
    mockUserRepository = TestHelpers.createMockRepository<UserRepository>([
      "findByEmail",
      "findById",
      "create",
      "updateLastLogin",
    ]);

    // Create mock Supabase clients
    mockSupabaseAuth = {
      auth: {
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        getUser: vi.fn(),
        refreshSession: vi.fn(),
        resetPasswordForEmail: vi.fn(),
        updateUser: vi.fn(),
        verifyOtp: vi.fn(),
        resend: vi.fn(),
        setSession: vi.fn(),
      },
    };

    mockSupabaseAdmin = {
      auth: {
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        getUser: vi.fn(),
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

  describe("register", () => {
    it("should register a new user successfully", async () => {
      const registerDto = AuthFactory.createRegisterDto();
      const supabaseUser = AuthFactory.createSupabaseUser();
      const session = AuthFactory.createSupabaseSession();
      const createdUser = AuthFactory.createTestUser();

      // Mock repository calls
      (mockUserRepository.findByEmail as any).mockResolvedValue(null);
      (mockUserRepository.create as any).mockResolvedValue(createdUser);

      // Mock Supabase auth calls
      mockSupabaseAuth.auth.signUp.mockResolvedValue({
        data: { user: supabaseUser, session },
        error: null,
      });

      const result = await authService.register(registerDto);

      expect(result.user).toBeDefined();
      expect(result.session).toEqual(session);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(
        registerDto.email,
      );
      expect(mockSupabaseAuth.auth.signUp).toHaveBeenCalledWith({
        email: registerDto.email,
        password: registerDto.password,
        options: {
          data: {
            first_name: registerDto.first_name,
            last_name: registerDto.last_name,
          },
        },
      });
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: supabaseUser.id,
          email: registerDto.email,
          first_name: registerDto.first_name,
          last_name: registerDto.last_name,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
        }),
      );
    });

    it("should throw error when passwords don't match", async () => {
      const registerDto = AuthFactory.createRegisterDto({
        password: "Password123!",
        confirmPassword: "DifferentPassword123!",
      });

      await expect(authService.register(registerDto)).rejects.toThrow(
        new AuthException("Passwords do not match", 400),
      );
    });

    it("should throw error when email already exists", async () => {
      const registerDto = AuthFactory.createRegisterDto();
      const existingUser = AuthFactory.createTestUser();

      (mockUserRepository.findByEmail as any).mockResolvedValue(existingUser);

      await expect(authService.register(registerDto)).rejects.toThrow(
        new AuthException("Email already registered", 409),
      );
    });

    it("should throw error when Supabase registration fails", async () => {
      const registerDto = AuthFactory.createRegisterDto();

      (mockUserRepository.findByEmail as any).mockResolvedValue(null);
      mockSupabaseAuth.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Registration failed" },
      });

      await expect(authService.register(registerDto)).rejects.toThrow(
        AuthException,
      );
    });

    it("should set pending verification status for unconfirmed email", async () => {
      const registerDto = AuthFactory.createRegisterDto();
      const supabaseUser = AuthFactory.createSupabaseUser({
        email_confirmed_at: undefined,
      });
      const session = AuthFactory.createSupabaseSession();
      const createdUser = AuthFactory.createTestUser();

      (mockUserRepository.findByEmail as any).mockResolvedValue(null);
      (mockUserRepository.create as any).mockResolvedValue(createdUser);

      mockSupabaseAuth.auth.signUp.mockResolvedValue({
        data: { user: supabaseUser, session },
        error: null,
      });

      await authService.register(registerDto);

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: UserStatus.PENDING_VERIFICATION,
          email_verified: false,
        }),
      );
    });
  });

  describe("login", () => {
    it("should login user successfully", async () => {
      const loginDto = AuthFactory.createLoginDto();
      const supabaseUser = AuthFactory.createSupabaseUser();
      const session = AuthFactory.createSupabaseSession();
      const user = AuthFactory.createTestUser();

      mockSupabaseAuth.auth.signInWithPassword.mockResolvedValue({
        data: { user: supabaseUser, session },
        error: null,
      });
      (mockUserRepository.findById as any).mockResolvedValue(user);
      (mockUserRepository.updateLastLogin as any).mockResolvedValue(undefined);

      const result = await authService.login(loginDto);

      expect(result.user).toBeDefined();
      expect(result.session).toEqual(session);
      expect(mockSupabaseAuth.auth.signInWithPassword).toHaveBeenCalledWith({
        email: loginDto.email,
        password: loginDto.password,
      });
      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith(user.id);
    });

    it("should throw InvalidCredentialsException for invalid credentials", async () => {
      const loginDto = AuthFactory.createLoginDto();

      mockSupabaseAuth.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Invalid credentials" },
      });

      await expect(authService.login(loginDto)).rejects.toThrow(
        InvalidCredentialsException,
      );
    });

    it("should throw UserNotFoundException when user profile not found", async () => {
      const loginDto = AuthFactory.createLoginDto();
      const supabaseUser = AuthFactory.createSupabaseUser();
      const session = AuthFactory.createSupabaseSession();

      mockSupabaseAuth.auth.signInWithPassword.mockResolvedValue({
        data: { user: supabaseUser, session },
        error: null,
      });
      (mockUserRepository.findById as any).mockResolvedValue(null);

      await expect(authService.login(loginDto)).rejects.toThrow(
        UserNotFoundException,
      );
    });

    it("should throw AccountSuspendedException for suspended user", async () => {
      const loginDto = AuthFactory.createLoginDto();
      const supabaseUser = AuthFactory.createSupabaseUser();
      const session = AuthFactory.createSupabaseSession();
      const suspendedUser = AuthFactory.createSuspendedUser();

      mockSupabaseAuth.auth.signInWithPassword.mockResolvedValue({
        data: { user: supabaseUser, session },
        error: null,
      });
      (mockUserRepository.findById as any).mockResolvedValue(suspendedUser);

      await expect(authService.login(loginDto)).rejects.toThrow(
        AccountSuspendedException,
      );
    });

    it("should throw AuthException for inactive user", async () => {
      const loginDto = AuthFactory.createLoginDto();
      const supabaseUser = AuthFactory.createSupabaseUser();
      const session = AuthFactory.createSupabaseSession();
      const inactiveUser = AuthFactory.createTestUser({
        status: UserStatus.INACTIVE,
      });

      mockSupabaseAuth.auth.signInWithPassword.mockResolvedValue({
        data: { user: supabaseUser, session },
        error: null,
      });
      (mockUserRepository.findById as any).mockResolvedValue(inactiveUser);

      await expect(authService.login(loginDto)).rejects.toThrow(
        new AuthException("Account is inactive", 403),
      );
    });
  });

  describe("logout", () => {
    it("should logout user successfully", async () => {
      const accessToken = AuthFactory.createValidJwtToken();

      mockSupabaseAuth.auth.setSession.mockResolvedValue({ error: null });
      mockSupabaseAuth.auth.signOut.mockResolvedValue({ error: null });

      await authService.logout(accessToken);

      expect(mockSupabaseAuth.auth.setSession).toHaveBeenCalledWith({
        access_token: accessToken,
        refresh_token: "",
      });
      expect(mockSupabaseAuth.auth.signOut).toHaveBeenCalled();
    });

    it("should throw AuthException when logout fails", async () => {
      const accessToken = AuthFactory.createValidJwtToken();

      mockSupabaseAuth.auth.setSession.mockResolvedValue({ error: null });
      mockSupabaseAuth.auth.signOut.mockResolvedValue({
        error: { message: "Logout failed" },
      });

      await expect(authService.logout(accessToken)).rejects.toThrow(
        new AuthException("Logout failed", 500),
      );
    });
  });

  describe("refreshToken", () => {
    it("should refresh token successfully", async () => {
      const refreshTokenDto = { refresh_token: "refresh-token-123" };
      const session = AuthFactory.createSupabaseSession();

      mockSupabaseAuth.auth.refreshSession.mockResolvedValue({
        data: { session },
        error: null,
      });

      const result = await authService.refreshToken(refreshTokenDto);

      expect(result.session).toEqual(session);
      expect(mockSupabaseAuth.auth.refreshSession).toHaveBeenCalledWith({
        refresh_token: refreshTokenDto.refresh_token,
      });
    });

    it("should throw AuthException when refresh fails", async () => {
      const refreshTokenDto = { refresh_token: "invalid-token" };

      mockSupabaseAuth.auth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: "Invalid refresh token" },
      });

      await expect(authService.refreshToken(refreshTokenDto)).rejects.toThrow(
        new AuthException("Token refresh failed", 401),
      );
    });
  });

  describe("forgotPassword", () => {
    it("should send password reset email successfully", async () => {
      const email = "test@example.com";

      mockSupabaseAuth.auth.resetPasswordForEmail.mockResolvedValue({
        error: null,
      });

      await authService.forgotPassword(email);

      expect(mockSupabaseAuth.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        email,
        {
          redirectTo: expect.stringContaining("/reset-password"),
        },
      );
    });

    it("should throw PasswordResetException when email sending fails", async () => {
      const email = "test@example.com";

      mockSupabaseAuth.auth.resetPasswordForEmail.mockResolvedValue({
        error: { message: "Email sending failed" },
      });

      await expect(authService.forgotPassword(email)).rejects.toThrow(
        "Password reset request failed",
      );
    });
  });

  describe("changePassword", () => {
    it("should change password successfully", async () => {
      const userId = "user-id-123";
      const changePasswordDto = {
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      };
      const user = AuthFactory.createTestUser({ id: userId });

      (mockUserRepository.findById as any).mockResolvedValue(user);
      mockSupabaseAuth.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: AuthFactory.createSupabaseUser(),
          session: AuthFactory.createSupabaseSession(),
        },
        error: null,
      });
      mockSupabaseAuth.auth.updateUser.mockResolvedValue({ error: null });

      await authService.changePassword(userId, changePasswordDto);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockSupabaseAuth.auth.signInWithPassword).toHaveBeenCalledWith({
        email: user.email,
        password: changePasswordDto.currentPassword,
      });
      expect(mockSupabaseAuth.auth.updateUser).toHaveBeenCalledWith({
        password: changePasswordDto.newPassword,
      });
    });

    it("should throw error when passwords don't match", async () => {
      const userId = "user-id-123";
      const changePasswordDto = {
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword123!",
        confirmPassword: "DifferentPassword123!",
      };

      await expect(
        authService.changePassword(userId, changePasswordDto),
      ).rejects.toThrow(new AuthException("Passwords do not match", 400));
    });

    it("should throw error when current password is incorrect", async () => {
      const userId = "user-id-123";
      const changePasswordDto = {
        currentPassword: "WrongPassword123!",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!",
      };
      const user = AuthFactory.createTestUser({ id: userId });

      (mockUserRepository.findById as any).mockResolvedValue(user);
      mockSupabaseAuth.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: "Invalid credentials" },
      });

      await expect(
        authService.changePassword(userId, changePasswordDto),
      ).rejects.toThrow(
        new AuthException("Current password is incorrect", 400),
      );
    });
  });

  describe("verifyUser", () => {
    it("should verify user successfully", async () => {
      const accessToken = AuthFactory.createValidJwtToken();
      const supabaseUser = AuthFactory.createSupabaseUser();
      const user = AuthFactory.createTestUser();

      mockSupabaseAuth.auth.getUser.mockResolvedValue({
        data: { user: supabaseUser },
        error: null,
      });
      (mockUserRepository.findById as any).mockResolvedValue(user);

      const result = await authService.verifyUser(accessToken);

      expect(result).toEqual(user);
      expect(mockSupabaseAuth.auth.getUser).toHaveBeenCalledWith(accessToken);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(supabaseUser.id);
    });

    it("should throw AuthException for invalid token", async () => {
      const accessToken = AuthFactory.createInvalidJwtToken();

      mockSupabaseAuth.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Invalid token" },
      });

      await expect(authService.verifyUser(accessToken)).rejects.toThrow(
        new AuthException("Invalid token", 401),
      );
    });

    it("should throw UserNotFoundException when user profile not found", async () => {
      const accessToken = AuthFactory.createValidJwtToken();
      const supabaseUser = AuthFactory.createSupabaseUser();

      mockSupabaseAuth.auth.getUser.mockResolvedValue({
        data: { user: supabaseUser },
        error: null,
      });
      (mockUserRepository.findById as any).mockResolvedValue(null);

      await expect(authService.verifyUser(accessToken)).rejects.toThrow(
        UserNotFoundException,
      );
    });
  });

  describe("getCurrentUser", () => {
    it("should get current user successfully", async () => {
      const userId = "user-id-123";
      const user = AuthFactory.createTestUser({ id: userId });

      (mockUserRepository.findById as any).mockResolvedValue(user);

      const result = await authService.getCurrentUser(userId);

      expect(result).toBeDefined();
      expect(result.id).toBe(userId);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
    });

    it("should throw UserNotFoundException when user not found", async () => {
      const userId = "non-existent-user";

      (mockUserRepository.findById as any).mockResolvedValue(null);

      await expect(authService.getCurrentUser(userId)).rejects.toThrow(
        UserNotFoundException,
      );
    });
  });

  describe("verifyEmail", () => {
    it("should verify email successfully", async () => {
      const token = "verification-token-123";

      mockSupabaseAuth.auth.verifyOtp.mockResolvedValue({ error: null });

      await authService.verifyEmail(token);

      expect(mockSupabaseAuth.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: token,
        type: "email",
      });
    });

    it("should throw AuthException when verification fails", async () => {
      const token = "invalid-token";

      mockSupabaseAuth.auth.verifyOtp.mockResolvedValue({
        error: { message: "Invalid token" },
      });

      await expect(authService.verifyEmail(token)).rejects.toThrow(
        new AuthException("Email verification failed", 400),
      );
    });
  });

  describe("resendVerification", () => {
    it("should resend verification email successfully", async () => {
      const email = "test@example.com";

      mockSupabaseAuth.auth.resend.mockResolvedValue({ error: null });

      await authService.resendVerification(email);

      expect(mockSupabaseAuth.auth.resend).toHaveBeenCalledWith({
        type: "signup",
        email,
      });
    });

    it("should throw AuthException when resend fails", async () => {
      const email = "test@example.com";

      mockSupabaseAuth.auth.resend.mockResolvedValue({
        error: { message: "Resend failed" },
      });

      await expect(authService.resendVerification(email)).rejects.toThrow(
        new AuthException("Verification email resend failed", 400),
      );
    });
  });
});
