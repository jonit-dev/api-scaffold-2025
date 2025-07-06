import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AccountSuspendedException,
  AuthException,
  InvalidCredentialsException,
  UserNotFoundException,
} from "@exceptions/auth.exception";
import {
  SetupHelpers,
  ScenarioHelpers,
  AssertionHelpers,
  MockHelpers,
} from "@tests/utils/test.helpers";
import { AuthService } from "../auth.service";
import { config } from "../../config/env";

describe("AuthService (Refactored with Test Utils)", () => {
  let authService: AuthService;
  let mockUserRepository: any;
  let mockSupabaseAuth: any;
  let mockSupabaseAdmin: any;
  let testData: any;

  beforeEach(() => {
    // Force AuthService to use Supabase for these tests
    vi.spyOn(config.database, "provider", "get").mockReturnValue("supabase");

    const setup = SetupHelpers.createAuthTestSetup();
    mockUserRepository = setup.mockUserRepository;
    mockSupabaseAuth = setup.mockSupabaseAuth;
    mockSupabaseAdmin = setup.mockSupabaseAdmin;
    testData = MockHelpers.createTestDataSets();

    authService = new AuthService(
      mockUserRepository,
      mockSupabaseAuth,
      mockSupabaseAdmin,
    );
  });

  describe("register", () => {
    it("should register a new user successfully", async () => {
      const { registerDto, expectedUser } =
        ScenarioHelpers.setupSuccessfulRegistration(
          mockUserRepository,
          mockSupabaseAuth,
        );

      const result = await authService.register(registerDto);

      AssertionHelpers.expectAuthResponse(result);
      AssertionHelpers.expectRepositoryCalls(mockUserRepository, [
        { method: "findByEmail", args: [registerDto.email] },
        { method: "create" },
      ]);
    });

    it("should throw error when passwords don't match", async () => {
      const registerDto = testData.dtos.register;
      registerDto.confirmPassword = "DifferentPassword123!";

      await AssertionHelpers.expectAsyncError(
        () => authService.register(registerDto),
        AuthException,
        "Passwords do not match",
      );
    });

    it("should throw error when email already exists", async () => {
      const { registerDto, existingUser } =
        ScenarioHelpers.setupRegistrationWithExistingEmail(mockUserRepository);

      await AssertionHelpers.expectAsyncError(
        () => authService.register(registerDto),
        AuthException,
      );
      AssertionHelpers.expectRepositoryCalls(mockUserRepository, [
        { method: "findByEmail", args: [registerDto.email] },
      ]);
    });
  });

  describe("login", () => {
    it("should login user successfully", async () => {
      const { loginDto, user, expectedSession } =
        ScenarioHelpers.setupSuccessfulLogin(
          mockUserRepository,
          mockSupabaseAuth,
        );

      const result = await authService.login(loginDto);

      AssertionHelpers.expectAuthResponse(result);
      AssertionHelpers.expectRepositoryCalls(mockUserRepository, [
        { method: "findById", args: [user.id] },
        { method: "updateLastLogin", args: [user.id] },
      ]);
    });

    it("should throw InvalidCredentialsException for invalid credentials", async () => {
      const { loginDto } = ScenarioHelpers.setupFailedLogin(
        mockSupabaseAuth,
        "invalid_credentials",
      );

      await AssertionHelpers.expectAsyncError(
        () => authService.login(loginDto),
        InvalidCredentialsException,
      );
    });

    it("should throw UserNotFoundException when user profile not found", async () => {
      const { loginDto } = ScenarioHelpers.setupFailedLogin(
        mockSupabaseAuth,
        "user_not_found",
      );

      MockHelpers.setupRepositoryResponses(mockUserRepository, {
        findById: null, // User not found in database
      });

      await AssertionHelpers.expectAsyncError(
        () => authService.login(loginDto),
        UserNotFoundException,
      );
    });

    it("should throw AccountSuspendedException for suspended user", async () => {
      MockHelpers.setupSupabaseAuthResponses(mockSupabaseAuth, "success");
      MockHelpers.setupRepositoryResponses(mockUserRepository, {
        findById: testData.users.suspended,
      });

      const loginDto = testData.dtos.validLogin;

      await AssertionHelpers.expectAsyncError(
        () => authService.login(loginDto),
        AccountSuspendedException,
      );
    });
  });

  describe("logout", () => {
    it("should logout user successfully", async () => {
      MockHelpers.setupSupabaseAuthResponses(mockSupabaseAuth, "success");
      mockSupabaseAuth.auth.signOut.mockResolvedValue({ error: null });

      await authService.logout();

      expect(mockSupabaseAuth.auth.signOut).toHaveBeenCalled();
    });

    it("should throw AuthException when logout fails", async () => {
      mockSupabaseAuth.auth.signOut.mockResolvedValue({
        error: { message: "Logout failed" },
      });

      await AssertionHelpers.expectAsyncError(
        () => authService.logout(),
        AuthException,
        "Logout failed",
      );
    });
  });

  describe("verifyUser", () => {
    it("should verify user successfully", async () => {
      const accessToken = testData.auth.validToken;

      MockHelpers.setupSupabaseAuthResponses(mockSupabaseAuth, "success");
      MockHelpers.setupRepositoryResponses(mockUserRepository, {
        findById: testData.users.regular,
      });

      const result = await authService.verifyUser(accessToken);

      AssertionHelpers.expectUserStructure(result);
      expect(mockSupabaseAuth.auth.getUser).toHaveBeenCalledWith(accessToken);
      AssertionHelpers.expectRepositoryCalls(mockUserRepository, [
        { method: "findById", args: [testData.users.regular.id] },
      ]);
    });

    it("should throw AuthException for invalid token", async () => {
      const accessToken = testData.auth.invalidToken;

      MockHelpers.setupSupabaseAuthResponses(mockSupabaseAuth, "invalid");

      await AssertionHelpers.expectAsyncError(
        () => authService.verifyUser(accessToken),
        AuthException,
        "Invalid token",
      );
    });
  });
});
