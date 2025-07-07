import { Container } from "typedi";
import { expect, vi } from "vitest";
import { DatabaseFactory } from "../factories/database.factory";
import {
  getRedisMockInstance,
  createRedisMock,
  IMockRedisClient,
} from "../setup/redis.mock";

// Re-export new helper classes for convenience
export * from "./setup.helpers";
export { AssertionHelpers } from "./assertion.helpers";
export { MockHelpers } from "./mock.helpers";
export * from "./scenario.helpers";

export class TestHelpers {
  static setupMockSupabaseClient() {
    // Placeholder for backward compatibility
    return {};
  }

  static createSuccessfulQuery<T>(data: T[]) {
    return Promise.resolve(DatabaseFactory.createSupabaseResponse(data));
  }

  static createFailedQuery(error: string) {
    return Promise.resolve(
      DatabaseFactory.createSupabaseResponse([], new Error(error)),
    );
  }

  static createTimeoutQuery() {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Query timeout")), 1000);
    });
  }

  static async waitForAsync(fn: () => Promise<any>, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Test timeout"));
      }, timeout);

      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  static createMockService<T>(methods: Array<keyof T>): T {
    const mockService = {} as T;
    methods.forEach((method) => {
      (mockService as any)[method] = vi.fn();
    });
    return mockService;
  }

  static createMockRepository<T>(methods: Array<keyof T>): T {
    const mockRepository = {} as T;
    methods.forEach((method) => {
      (mockRepository as any)[method] = vi.fn();
    });
    return mockRepository;
  }

  static async cleanupTestData(tableName: string) {
    // TODO: Implement with Prisma client
    console.log(`Cleaning up test data for table: ${tableName}`);
  }

  static async seedTestData<T>(tableName: string, data: T[]) {
    // TODO: Implement with Prisma client
    console.log(`Seeding test data for table: ${tableName}`, data);
  }

  static createMockRedisClient(): IMockRedisClient {
    // Use centralized Redis mock
    return createRedisMock();
  }

  static setupMockRedisClient(mockClient: any = null): IMockRedisClient {
    // Use centralized mock instance or get existing one
    const client = mockClient
      ? { ...getRedisMockInstance(), ...mockClient }
      : getRedisMockInstance();
    Container.set("redis", client);
    return client;
  }

  static resetAllMocks() {
    vi.clearAllMocks();
    Container.reset();
  }

  static createExpectedErrorResponse(status: number, message: string) {
    return {
      success: false,
      error: expect.objectContaining({
        status,
        message,
        timestamp: expect.any(Date),
      }),
    };
  }

  static createExpectedSuccessResponse(data: any, message = "Success") {
    return {
      success: true,
      data,
      message,
      timestamp: expect.any(Date),
    };
  }

  static async expectAsyncToThrow(fn: () => Promise<any>, expectedError: any) {
    await expect(fn()).rejects.toThrow(expectedError);
  }

  static async expectAsyncToResolve(
    fn: () => Promise<any>,
    expectedValue: any,
  ) {
    await expect(fn()).resolves.toEqual(expectedValue);
  }

  static createDelay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static mockConsole() {
    return {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      info: vi.spyOn(console, "info").mockImplementation(() => {}),
    };
  }

  static restoreConsole() {
    vi.restoreAllMocks();
  }
}
