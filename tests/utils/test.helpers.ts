import { SupabaseClient } from '@supabase/supabase-js';
import { Container } from 'typedi';
import { expect, vi } from 'vitest';
import { DatabaseFactory } from '../factories/database.factory';

export class TestHelpers {
  static createMockSupabaseClient() {
    const mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      throwOnError: vi.fn().mockReturnThis(),
    };

    return {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
      auth: {
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        getUser: vi.fn(),
        getSession: vi.fn(),
      },
    };
  }

  static setupMockSupabaseClient(mockClient: any = null) {
    const client = mockClient || this.createMockSupabaseClient();
    Container.set('supabase', client);
    return client;
  }

  static createSuccessfulQuery<T>(data: T[]) {
    return Promise.resolve(DatabaseFactory.createSupabaseResponse(data));
  }

  static createFailedQuery(error: string) {
    return Promise.resolve(
      DatabaseFactory.createSupabaseResponse([], new Error(error))
    );
  }

  static createTimeoutQuery() {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), 1000);
    });
  }

  static async waitForAsync(fn: () => Promise<any>, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Test timeout'));
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
    const supabase = Container.get<SupabaseClient>('supabase');
    await supabase.from(tableName).delete().neq('id', '');
  }

  static async seedTestData<T>(tableName: string, data: T[]) {
    const supabase = Container.get<SupabaseClient>('supabase');
    await supabase.from(tableName).insert(data);
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

  static createExpectedSuccessResponse(data: any, message = 'Success') {
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
    expectedValue: any
  ) {
    await expect(fn()).resolves.toEqual(expectedValue);
  }

  static createDelay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static mockConsole() {
    return {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
    };
  }

  static restoreConsole() {
    vi.restoreAllMocks();
  }
}
