import { vi } from "vitest";
import { AuthFactory } from "../factories/auth.factory";

export class MockHelpers {
  /**
   * Creates a complete Supabase query chain mock that can handle complex queries
   */
  static createSupabaseQueryChain(mockData: any = null, mockError: any = null) {
    const chainMethods = {
      select: vi.fn(),
      eq: vi.fn(),
      neq: vi.fn(),
      gt: vi.fn(),
      gte: vi.fn(),
      lt: vi.fn(),
      lte: vi.fn(),
      like: vi.fn(),
      ilike: vi.fn(),
      or: vi.fn(),
      and: vi.fn(),
      in: vi.fn(),
      not: vi.fn(),
      is: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
      limit: vi.fn(),
      single: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    };

    // Make all methods return the chain for fluent interface
    Object.keys(chainMethods).forEach((method) => {
      chainMethods[method as keyof typeof chainMethods].mockReturnThis();
    });

    // Set up terminal methods (single, promise resolution)
    chainMethods.single.mockResolvedValue({
      data: mockData,
      error: mockError,
    });

    // Create a mock that resolves for promise-like behavior
    const mockChain = {
      ...chainMethods,
      then: (onResolve: (value: any) => any) => {
        return Promise.resolve(
          onResolve({
            data: mockData,
            error: mockError,
            count: Array.isArray(mockData) ? mockData.length : mockData ? 1 : 0,
          }),
        );
      },
      catch: (onReject: (error: any) => any) => {
        return mockError
          ? Promise.reject(onReject(mockError))
          : Promise.resolve();
      },
    };

    return mockChain;
  }

  /**
   * Creates a mock Supabase client with configurable responses
   */
  static createConfigurableSupabaseMock(
    responses: {
      [table: string]: {
        [operation: string]: {
          data?: any;
          error?: any;
          count?: number;
        };
      };
    } = {},
  ) {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        const tableResponses = responses[table] || {};
        return this.createSupabaseQueryChain(
          tableResponses.select?.data,
          tableResponses.select?.error,
        );
      }),
      auth: {
        getUser: vi.fn(),
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        refreshSession: vi.fn(),
        resetPasswordForEmail: vi.fn(),
        updateUser: vi.fn(),
        verifyOtp: vi.fn(),
        resend: vi.fn(),
        setSession: vi.fn(),
      },
    };

    return mockSupabase;
  }

  /**
   * Creates mock authentication scenarios for testing
   */
  static createAuthScenarios() {
    return {
      validUser: {
        token: AuthFactory.createValidJwtToken(),
        supabaseUser: AuthFactory.createSupabaseUser(),
        userProfile: AuthFactory.createTestUser(),
        session: AuthFactory.createSupabaseSession(),
      },
      adminUser: {
        token: AuthFactory.createValidJwtToken(),
        supabaseUser: AuthFactory.createSupabaseUser(),
        userProfile: AuthFactory.createAdminUser(),
        session: AuthFactory.createSupabaseSession(),
      },
      expiredToken: {
        token: AuthFactory.createExpiredJwtToken(),
        error: { message: "Token expired" },
      },
      invalidToken: {
        token: AuthFactory.createInvalidJwtToken(),
        error: { message: "Invalid token" },
      },
      suspendedUser: {
        token: AuthFactory.createValidJwtToken(),
        supabaseUser: AuthFactory.createSupabaseUser(),
        userProfile: AuthFactory.createSuspendedUser(),
      },
    };
  }

  /**
   * Sets up common Supabase auth responses for different scenarios
   */
  static setupSupabaseAuthResponses(
    mockSupabaseAuth: any,
    scenario: "success" | "expired" | "invalid" | "error",
  ) {
    const scenarios = this.createAuthScenarios();

    switch (scenario) {
      case "success":
        mockSupabaseAuth.auth.getUser.mockResolvedValue({
          data: { user: scenarios.validUser.supabaseUser },
          error: null,
        });
        mockSupabaseAuth.auth.signInWithPassword.mockResolvedValue({
          data: {
            user: scenarios.validUser.supabaseUser,
            session: scenarios.validUser.session,
          },
          error: null,
        });
        break;
      case "expired":
        mockSupabaseAuth.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: scenarios.expiredToken.error,
        });
        break;
      case "invalid":
        mockSupabaseAuth.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: scenarios.invalidToken.error,
        });
        break;
      case "error":
        mockSupabaseAuth.auth.getUser.mockRejectedValue(
          new Error("Database connection failed"),
        );
        break;
    }
  }

  /**
   * Creates mock repository responses for common operations
   */
  static setupRepositoryResponses(
    mockRepository: any,
    responses: {
      findById?: any;
      findByEmail?: any;
      create?: any;
      update?: any;
      findUsersPaginated?: any;
      isEmailUnique?: boolean;
    },
  ) {
    if (responses.findById !== undefined) {
      (mockRepository.findById as any).mockResolvedValue(responses.findById);
    }
    if (responses.findByEmail !== undefined) {
      (mockRepository.findByEmail as any).mockResolvedValue(
        responses.findByEmail,
      );
    }
    if (responses.create !== undefined) {
      (mockRepository.create as any).mockResolvedValue(responses.create);
    }
    if (responses.update !== undefined) {
      (mockRepository.update as any).mockResolvedValue(responses.update);
    }
    if (responses.findUsersPaginated !== undefined) {
      (mockRepository.findUsersPaginated as any).mockResolvedValue(
        responses.findUsersPaginated,
      );
    }
    if (responses.isEmailUnique !== undefined) {
      (mockRepository.isEmailUnique as any).mockResolvedValue(
        responses.isEmailUnique,
      );
    }
  }

  /**
   * Creates standardized test data sets
   */
  static createTestDataSets() {
    return {
      users: {
        regular: AuthFactory.createTestUser(),
        admin: AuthFactory.createAdminUser(),
        moderator: AuthFactory.createModeratorUser(),
        suspended: AuthFactory.createSuspendedUser(),
        unverified: AuthFactory.createUnverifiedUser(),
      },
      dtos: {
        login: AuthFactory.createLoginDto(),
        register: AuthFactory.createRegisterDto(),
        validLogin: AuthFactory.createLoginDto({
          email: "valid@example.com",
          password: "ValidPassword123!",
        }),
        invalidLogin: AuthFactory.createLoginDto({
          email: "invalid@example.com",
          password: "wrongpassword",
        }),
      },
      auth: {
        validResponse: AuthFactory.createAuthResponseDto(),
        validToken: AuthFactory.createValidJwtToken(),
        expiredToken: AuthFactory.createExpiredJwtToken(),
        invalidToken: AuthFactory.createInvalidJwtToken(),
      },
      pagination: {
        firstPage: {
          data: [AuthFactory.createTestUser(), AuthFactory.createAdminUser()],
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            hasNext: false,
            hasPrevious: false,
          },
        },
        emptyPage: {
          data: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            hasNext: false,
            hasPrevious: false,
          },
        },
      },
    };
  }

  /**
   * Creates database error responses for testing error handling
   */
  static createDatabaseErrors() {
    return {
      notFound: { code: "PGRST116", message: "No rows found" },
      connectionError: {
        code: "CONNECTION_ERROR",
        message: "Database connection failed",
      },
      constraintViolation: {
        code: "23505",
        message: "Unique constraint violation",
      },
      timeout: { code: "TIMEOUT", message: "Query timeout" },
      permissionDenied: { code: "42501", message: "Permission denied" },
    };
  }
}
