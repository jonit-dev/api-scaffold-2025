import { AuthService } from "@services/auth.service";
import { UserRepository } from "@repositories/user.repository";
import { AuthFactory } from "../factories/auth.factory";
import { MockHelpers } from "./mock.helpers";
import { SetupHelpers } from "./setup.helpers";

/**
 * Pre-configured test scenarios for common testing patterns
 */
export class ScenarioHelpers {
  /**
   * Sets up successful user authentication scenario
   */
  static setupSuccessfulAuth(
    mockAuthService: AuthService,
    mockSupabaseAuth: any,
  ) {
    const testData = MockHelpers.createTestDataSets();
    const authScenarios = MockHelpers.createAuthScenarios();

    MockHelpers.setupSupabaseAuthResponses(mockSupabaseAuth, "success");
    (mockAuthService.verifyUser as any).mockResolvedValue(
      testData.users.regular,
    );
    (mockAuthService.getCurrentUser as any).mockResolvedValue(
      testData.users.regular,
    );
    (mockAuthService.getUserProfile as any).mockResolvedValue(
      testData.users.regular,
    );

    return {
      user: testData.users.regular,
      token: authScenarios.validUser.token,
      session: authScenarios.validUser.session,
    };
  }

  /**
   * Sets up failed authentication scenario
   */
  static setupFailedAuth(
    mockAuthService: AuthService,
    mockSupabaseAuth: any,
    reason: "expired" | "invalid" | "error" = "invalid",
  ) {
    MockHelpers.setupSupabaseAuthResponses(mockSupabaseAuth, reason);

    const error =
      reason === "expired"
        ? new Error("Token expired")
        : reason === "invalid"
          ? new Error("Invalid token")
          : new Error("Authentication failed");

    (mockAuthService.verifyUser as any).mockRejectedValue(error);

    return { error };
  }

  /**
   * Sets up successful user registration scenario
   */
  static setupSuccessfulRegistration(
    mockUserRepository: UserRepository,
    mockSupabaseAuth: any,
  ) {
    const testData = MockHelpers.createTestDataSets();

    MockHelpers.setupRepositoryResponses(mockUserRepository, {
      findByEmail: null, // Email not found (unique)
      create: testData.users.regular,
    });

    mockSupabaseAuth.auth.signUp.mockResolvedValue({
      data: {
        user: AuthFactory.createSupabaseUser(),
        session: AuthFactory.createSupabaseSession(),
      },
      error: null,
    });

    return {
      registerDto: testData.dtos.register,
      createdUser: testData.users.regular,
      expectedUser: testData.users.regular,
    };
  }

  /**
   * Sets up user registration with existing email scenario
   */
  static setupRegistrationWithExistingEmail(
    mockUserRepository: UserRepository,
  ) {
    const testData = MockHelpers.createTestDataSets();

    MockHelpers.setupRepositoryResponses(mockUserRepository, {
      findByEmail: testData.users.regular, // Email already exists
    });

    return {
      registerDto: testData.dtos.register,
      existingUser: testData.users.regular,
    };
  }

  /**
   * Sets up successful user login scenario
   */
  static setupSuccessfulLogin(
    mockUserRepository: UserRepository,
    mockSupabaseAuth: any,
  ) {
    const testData = MockHelpers.createTestDataSets();

    MockHelpers.setupSupabaseAuthResponses(mockSupabaseAuth, "success");
    MockHelpers.setupRepositoryResponses(mockUserRepository, {
      findById: testData.users.regular,
    });

    (mockUserRepository.updateLastLogin as any).mockResolvedValue(undefined);

    return {
      loginDto: testData.dtos.validLogin,
      user: testData.users.regular,
      expectedSession: AuthFactory.createSupabaseSession(),
    };
  }

  /**
   * Sets up failed login scenario
   */
  static setupFailedLogin(
    mockSupabaseAuth: any,
    reason: "invalid_credentials" | "user_not_found" | "suspended",
  ) {
    const testData = MockHelpers.createTestDataSets();

    switch (reason) {
      case "invalid_credentials":
        mockSupabaseAuth.auth.signInWithPassword.mockResolvedValue({
          data: { user: null, session: null },
          error: { message: "Invalid credentials" },
        });
        break;

      case "user_not_found":
        MockHelpers.setupSupabaseAuthResponses(mockSupabaseAuth, "success");
        break;

      case "suspended":
        MockHelpers.setupSupabaseAuthResponses(mockSupabaseAuth, "success");
        break;
    }

    return {
      loginDto: testData.dtos.invalidLogin,
    };
  }

  /**
   * Sets up paginated user list scenario
   */
  static setupPaginatedUsers(
    mockUserRepository: UserRepository,
    options: {
      page?: number;
      limit?: number;
      total?: number;
      hasData?: boolean;
    } = {},
  ) {
    const { page = 1, limit = 10, total = 25, hasData = true } = options;
    const testData = MockHelpers.createTestDataSets();

    const paginatedResponse = {
      data: hasData ? [testData.users.regular, testData.users.admin] : [],
      pagination: {
        page,
        limit,
        total: hasData ? total : 0,
        hasNext: hasData && page * limit < total,
        hasPrevious: hasData && page > 1,
      },
    };

    MockHelpers.setupRepositoryResponses(mockUserRepository, {
      findUsersPaginated: paginatedResponse,
    });

    return { paginatedResponse };
  }

  /**
   * Sets up user update scenario
   */
  static setupUserUpdate(
    mockUserRepository: UserRepository,
    options: {
      userExists?: boolean;
      emailUnique?: boolean;
      updateSuccess?: boolean;
    } = {},
  ) {
    const {
      userExists = true,
      emailUnique = true,
      updateSuccess = true,
    } = options;
    const testData = MockHelpers.createTestDataSets();

    MockHelpers.setupRepositoryResponses(mockUserRepository, {
      findById: userExists ? testData.users.regular : null,
      isEmailUnique: emailUnique,
      update: updateSuccess
        ? { ...testData.users.regular, first_name: "Updated" }
        : null,
    });

    return {
      updateDto: { first_name: "Updated", email: "updated@example.com" },
      existingUser: userExists ? testData.users.regular : null,
      updatedUser: updateSuccess
        ? { ...testData.users.regular, first_name: "Updated" }
        : null,
    };
  }

  /**
   * Sets up middleware authentication scenario
   */
  static setupMiddlewareAuth(
    scenario:
      | "success"
      | "no_token"
      | "invalid_token"
      | "expired_token"
      | "user_not_found",
  ) {
    const { mockRequest, mockResponse, mockNext } =
      SetupHelpers.createMiddlewareTestSetup();
    const testData = MockHelpers.createTestDataSets();

    switch (scenario) {
      case "success":
        mockRequest.headers.authorization = `Bearer ${testData.auth.validToken}`;
        mockRequest.user = {
          id: testData.users.regular.id,
          email: testData.users.regular.email,
          role: testData.users.regular.role,
          supabaseUser: AuthFactory.createSupabaseUser(),
        };
        break;

      case "no_token":
        mockRequest.headers.authorization = undefined;
        break;

      case "invalid_token":
        mockRequest.headers.authorization = `Bearer ${testData.auth.invalidToken}`;
        break;

      case "expired_token":
        mockRequest.headers.authorization = `Bearer ${testData.auth.expiredToken}`;
        break;

      case "user_not_found":
        mockRequest.headers.authorization = `Bearer ${testData.auth.validToken}`;
        // user profile will be null in this case
        break;
    }

    return { mockRequest, mockResponse, mockNext };
  }

  /**
   * Sets up database error scenarios for testing error handling
   */
  static setupDatabaseError(
    mockRepository: UserRepository,
    operation: string,
    errorType: "not_found" | "connection" | "constraint" | "timeout",
  ) {
    const errors = MockHelpers.createDatabaseErrors();
    const error =
      errors[
        errorType === "not_found"
          ? "notFound"
          : errorType === "connection"
            ? "connectionError"
            : errorType === "constraint"
              ? "constraintViolation"
              : "timeout"
      ];

    const mockMethod = (mockRepository as any)[operation];
    if (mockMethod) {
      mockMethod.mockRejectedValue(new Error(error.message));
    }

    return { error };
  }

  /**
   * Creates a complete test scenario for controller integration tests
   */
  static setupControllerIntegrationTest(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  ) {
    const testData = MockHelpers.createTestDataSets();

    return {
      endpoint,
      method,
      authHeader: `Bearer ${testData.auth.validToken}`,
      user: testData.users.regular,
      testData,
    };
  }
}
