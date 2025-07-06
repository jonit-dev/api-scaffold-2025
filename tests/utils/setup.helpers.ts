import { Container } from "typedi";
import { vi } from "vitest";
import { AuthService } from "@services/auth.service";
import { UserRepository } from "@repositories/user.repository";
import { UserService } from "@services/user.service";
import { AuthFactory } from "../factories/auth.factory";
import { TestHelpers } from "./test.helpers";

export class SetupHelpers {
  /**
   * Creates a complete auth test setup with mocked services and containers
   */
  static createAuthTestSetup() {
    const mockAuthService = TestHelpers.createMockService<AuthService>([
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
      "getUserProfile",
    ]);

    const mockUserRepository = TestHelpers.createMockRepository<UserRepository>(
      [
        "findByEmail",
        "findById",
        "create",
        "update",
        "softDelete",
        "updateLastLogin",
        "findUsersPaginated",
        "isEmailUnique",
        "findByRole",
        "countByStatus",
        "updateEmailVerification",
        "findUnverifiedUsers",
      ],
    );

    const mockSupabaseAuth = {
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

    const mockSupabaseAdmin = {
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
    Container.set(AuthService, mockAuthService);

    return {
      mockAuthService,
      mockUserRepository,
      mockSupabaseAuth,
      mockSupabaseAdmin,
    };
  }

  /**
   * Creates a user service test setup with mocked dependencies
   */
  static createUserServiceTestSetup() {
    const mockUserRepository = TestHelpers.createMockRepository<UserRepository>(
      [
        "findByEmail",
        "create",
        "findById",
        "update",
        "softDelete",
        "findUsersPaginated",
        "isEmailUnique",
      ],
    );

    const userService = new UserService(
      mockUserRepository as unknown as UserRepository,
    );

    return {
      mockUserRepository,
      userService,
    };
  }

  /**
   * Creates Express middleware test setup with mock req/res/next
   */
  static createMiddlewareTestSetup(user?: any) {
    const mockRequest = {
      headers: {
        authorization: user
          ? `Bearer ${AuthFactory.createValidJwtToken()}`
          : undefined,
      },
      user: user || undefined,
    };

    const mockResponse = AuthFactory.createMockResponse();
    const mockNext = AuthFactory.createMockNext();

    return {
      mockRequest,
      mockResponse,
      mockNext,
    };
  }

  /**
   * Creates controller test setup with mocked dependencies
   */
  static createControllerTestSetup() {
    const { mockAuthService } = this.createAuthTestSetup();
    const { mockRequest, mockResponse } = this.createMiddlewareTestSetup(
      AuthFactory.createAuthenticatedUser(),
    );

    return {
      mockAuthService,
      mockRequest,
      mockResponse,
    };
  }

  /**
   * Creates repository test setup with mocked Supabase client
   */
  static createRepositoryTestSetup() {
    TestHelpers.resetAllMocks();
    const mockSupabase = TestHelpers.createMockSupabaseClient();
    const mockQueryBuilder = mockSupabase.from();
    Container.set("supabase", mockSupabase);

    return {
      mockSupabase,
      mockQueryBuilder,
    };
  }

  /**
   * Creates integration test setup with Express app
   */
  static createIntegrationTestSetup() {
    const { mockAuthService, mockUserRepository, mockSupabaseAuth } =
      this.createAuthTestSetup();

    return {
      mockAuthService,
      mockUserRepository,
      mockSupabaseAuth,
    };
  }

  /**
   * Resets all mocks and Container for clean test state
   */
  static resetTestEnvironment() {
    TestHelpers.resetAllMocks();
  }
}
