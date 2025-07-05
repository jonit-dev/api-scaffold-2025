import { vi } from "vitest";
import {
  SupabaseClient,
  User as SupabaseUser,
  Session,
} from "@supabase/supabase-js";

// Create a singleton Supabase mock instance
let supabaseMockInstance: any = null;
let supabaseAuthMockInstance: any = null;
let supabaseAdminMockInstance: any = null;

export interface IMockSupabaseClient {
  from: ReturnType<typeof vi.fn>;
  auth: {
    signUp: ReturnType<typeof vi.fn>;
    signInWithPassword: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
    getUser: ReturnType<typeof vi.fn>;
    getSession: ReturnType<typeof vi.fn>;
    refreshSession: ReturnType<typeof vi.fn>;
    resetPasswordForEmail: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
    verifyOtp: ReturnType<typeof vi.fn>;
    resend: ReturnType<typeof vi.fn>;
    setSession: ReturnType<typeof vi.fn>;
  };
}

export interface IMockQueryBuilder {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  like: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  throwOnError: ReturnType<typeof vi.fn>;
}

export function createMockQueryBuilder(): IMockQueryBuilder {
  const mockBuilder = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    gt: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    lte: vi.fn(),
    like: vi.fn(),
    ilike: vi.fn(),
    in: vi.fn(),
    is: vi.fn(),
    not: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    throwOnError: vi.fn(),
  };

  // Make all methods return the builder for chaining
  Object.keys(mockBuilder).forEach((key) => {
    (mockBuilder as any)[key].mockReturnValue(mockBuilder);
  });

  return mockBuilder;
}

export function createSupabaseMock(): IMockSupabaseClient {
  const mockQueryBuilder = createMockQueryBuilder();

  const mock = {
    from: vi.fn().mockReturnValue(mockQueryBuilder),
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(),
      getSession: vi.fn(),
      refreshSession: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      verifyOtp: vi.fn(),
      resend: vi.fn(),
      setSession: vi.fn(),
    },
  };

  if (!supabaseMockInstance) {
    supabaseMockInstance = mock;
  }

  return mock;
}

export function createSupabaseAuthMock(): IMockSupabaseClient {
  if (!supabaseAuthMockInstance) {
    supabaseAuthMockInstance = createSupabaseMock();
  }

  return supabaseAuthMockInstance;
}

export function createSupabaseAdminMock(): IMockSupabaseClient {
  if (!supabaseAdminMockInstance) {
    supabaseAdminMockInstance = createSupabaseMock();
  }

  return supabaseAdminMockInstance;
}

export function resetSupabaseMocks() {
  if (supabaseMockInstance) {
    vi.clearAllMocks();
  }
  if (supabaseAuthMockInstance) {
    vi.clearAllMocks();
  }
  if (supabaseAdminMockInstance) {
    vi.clearAllMocks();
  }
}

export function getSupabaseMockInstance(): IMockSupabaseClient {
  return supabaseMockInstance || createSupabaseMock();
}

export function getSupabaseAuthMockInstance(): IMockSupabaseClient {
  return supabaseAuthMockInstance || createSupabaseAuthMock();
}

export function getSupabaseAdminMockInstance(): IMockSupabaseClient {
  return supabaseAdminMockInstance || createSupabaseAdminMock();
}

// Mock response helpers
export function createMockSupabaseResponse<T>(data: T, error: any = null) {
  return {
    data,
    error,
    count: Array.isArray(data) ? data.length : data ? 1 : 0,
    status: error ? 400 : 200,
    statusText: error ? "Bad Request" : "OK",
  };
}

export function createMockSupabaseUser(
  overrides: Partial<SupabaseUser> = {},
): SupabaseUser {
  return {
    id: "mock-user-id",
    email: "test@example.com",
    email_confirmed_at: new Date().toISOString(),
    phone: null,
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {
      first_name: "Test",
      last_name: "User",
    },
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as SupabaseUser;
}

export function createMockSupabaseSession(
  overrides: Partial<Session> = {},
): Session {
  return {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: createMockSupabaseUser(),
    ...overrides,
  } as Session;
}

// Mock the Supabase config to return our mock instances
vi.mock("../../src/config/supabase", () => ({
  SupabaseConfig: {
    getClient: () => createSupabaseMock(),
    getAuthClient: () => createSupabaseAuthMock(),
    getAdminClient: () => createSupabaseAdminMock(),
  },
  getSupabaseClient: () => createSupabaseMock(),
  supabase: createSupabaseMock(),
  supabaseAuth: createSupabaseAuthMock(),
  supabaseAdmin: createSupabaseAdminMock(),
  checkSupabaseConnection: vi.fn().mockResolvedValue(true),
  default: createSupabaseMock(),
}));

// Mock the @supabase/supabase-js createClient function
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => createSupabaseMock()),
}));
