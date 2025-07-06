import { expect } from "vitest";
import { AuthService } from "@services/auth.service";
import { UserRepository } from "@repositories/user.repository";

export class AssertionHelpers {
  /**
   * Assert authentication service method calls with common patterns
   */
  static expectAuthServiceCalls(
    mockAuthService: AuthService,
    expectedCalls: {
      method: keyof AuthService;
      args?: any[];
      callCount?: number;
    }[],
  ) {
    expectedCalls.forEach(({ method, args, callCount = 1 }) => {
      const mockMethod = mockAuthService[method] as any;
      expect(mockMethod).toHaveBeenCalledTimes(callCount);
      if (args) {
        expect(mockMethod).toHaveBeenCalledWith(...args);
      }
    });
  }

  /**
   * Assert repository method calls with common patterns
   */
  static expectRepositoryCalls(
    mockRepository: UserRepository,
    expectedCalls: {
      method: keyof UserRepository;
      args?: any[];
      callCount?: number;
    }[],
  ) {
    expectedCalls.forEach(({ method, args, callCount = 1 }) => {
      const mockMethod = mockRepository[method] as any;
      expect(mockMethod).toHaveBeenCalledTimes(callCount);
      if (args) {
        expect(mockMethod).toHaveBeenCalledWith(...args);
      }
    });
  }

  /**
   * Assert Supabase query builder method calls
   */
  static expectSupabaseQueryCalls(
    mockSupabase: any,
    expectedCalls: {
      table?: string;
      method: string;
      args?: any[];
      callCount?: number;
    }[],
  ) {
    expectedCalls.forEach(
      ({ table = "users", method, args, callCount = 1 }) => {
        if (table) {
          expect(mockSupabase.from).toHaveBeenCalledWith(table);
        }

        const mockMethod = mockSupabase.from()[method];
        if (mockMethod) {
          expect(mockMethod).toHaveBeenCalledTimes(callCount);
          if (args) {
            expect(mockMethod).toHaveBeenCalledWith(...args);
          }
        }
      },
    );
  }

  /**
   * Assert middleware next function calls with error patterns
   */
  static expectMiddlewareError(
    mockNext: any,
    expectedErrorType?: any,
    expectedMessage?: string,
  ) {
    expect(mockNext).toHaveBeenCalledTimes(1);
    const error = mockNext.mock.calls[0][0];

    if (expectedErrorType) {
      expect(error).toBeInstanceOf(expectedErrorType);
    }

    if (expectedMessage) {
      expect(error.message).toBe(expectedMessage);
    }
  }

  /**
   * Assert middleware success (next called without error)
   */
  static expectMiddlewareSuccess(mockNext: any) {
    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext).toHaveBeenCalledWith();
  }

  /**
   * Assert user object structure and properties
   */
  static expectUserStructure(user: any, expectedProperties: Partial<any> = {}) {
    expect(user).toBeDefined();
    expect(user).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        email: expect.any(String),
        firstName: expect.any(String),
        lastName: expect.any(String),
        role: expect.any(String),
        status: expect.any(String),
        createdAt: expect.anything(), // Can be string or Date
        updatedAt: expect.anything(), // Can be string or Date
        ...expectedProperties,
      }),
    );
  }

  /**
   * Assert auth response structure
   */
  static expectAuthResponse(
    response: any,
    shouldHaveUser = true,
    shouldHaveSession = true,
  ) {
    expect(response).toBeDefined();

    if (shouldHaveUser) {
      expect(response.user).toBeDefined();
      this.expectUserStructure(response.user);
    }

    if (shouldHaveSession) {
      expect(response.session).toBeDefined();
      expect(response.session).toEqual(
        expect.objectContaining({
          access_token: expect.any(String),
          refresh_token: expect.any(String),
          expires_at: expect.any(Number),
          user: expect.any(Object),
        }),
      );
    }
  }

  /**
   * Assert pagination response structure
   */
  static expectPaginationResponse(response: any, expectedDataLength?: number) {
    expect(response).toBeDefined();
    expect(response.data).toEqual(expect.any(Array));
    expect(response.pagination).toEqual(
      expect.objectContaining({
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
        hasNext: expect.any(Boolean),
        hasPrevious: expect.any(Boolean),
      }),
    );

    if (expectedDataLength !== undefined) {
      expect(response.data).toHaveLength(expectedDataLength);
    }
  }

  /**
   * Assert that a method throws a specific error with message
   */
  static async expectAsyncError(
    fn: () => Promise<any>,
    expectedErrorType: any,
    expectedMessage?: string,
  ) {
    await expect(fn()).rejects.toThrow(expectedErrorType);

    if (expectedMessage) {
      try {
        await fn();
      } catch (error: any) {
        expect(error.message).toBe(expectedMessage);
      }
    }
  }

  /**
   * Assert that request object has authenticated user
   */
  static expectAuthenticatedRequest(request: any, expectedUserId?: string) {
    expect(request.user).toBeDefined();
    expect(request.user).toEqual(
      expect.objectContaining({
        id: expectedUserId || expect.any(String),
        email: expect.any(String),
        role: expect.any(String),
        supabaseUser: expect.any(Object),
      }),
    );
  }
}
