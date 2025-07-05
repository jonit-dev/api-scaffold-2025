import "reflect-metadata"; // CRITICAL: Must be imported first for TypeDI
import { Container } from "typedi";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { beforeAll, afterAll, afterEach } from "vitest";
import "./setup/redis.mock"; // Import centralized Redis mock
import { resetRedisMock, getRedisMockInstance } from "./setup/redis.mock";
import "./setup/supabase.mock"; // Import centralized Supabase mock
import {
  resetSupabaseMocks,
  getSupabaseMockInstance,
} from "./setup/supabase.mock";
import { CacheInterceptor } from "@/interceptors/cache.interceptor";
import { RedisService } from "@/services/redis.service";

// Load test environment variables
dotenv.config({ path: ".env.test" });

// Global test setup
beforeAll(async () => {
  // Use centralized Supabase mock instead of real client
  const mockSupabase = getSupabaseMockInstance();
  const mockRedis = getRedisMockInstance();

  // Register mock clients in TypeDI container
  Container.set("supabase", mockSupabase);
  Container.set("redis", mockRedis);

  // Register services that tests might need
  // RedisService will be created as needed and will use the mocked RedisConfig
  Container.set(CacheInterceptor, new CacheInterceptor());

  // Clear and seed test database (if needed)
  await clearTestData();
  await seedTestData();
});

afterAll(async () => {
  // Cleanup after all tests
  await clearTestData();
  Container.reset();
});

afterEach(async () => {
  // Reset mock data between tests
  resetRedisMock();
  resetSupabaseMocks();

  // Re-register essential services after Container.reset()
  const mockSupabase = getSupabaseMockInstance();
  const mockRedis = getRedisMockInstance();

  Container.set("supabase", mockSupabase);
  Container.set("redis", mockRedis);
  Container.set(CacheInterceptor, new CacheInterceptor());
});

async function clearTestData() {
  try {
    // Clear test data from Supabase mock
    const supabase = Container.get("supabase") as any;

    // Mock the cleanup calls - they don't need to do anything in tests
    if (supabase && typeof supabase.from === "function") {
      // Mock successful cleanup responses
      supabase.from.mockReturnValue({
        delete: () => ({
          neq: () => Promise.resolve({ data: [], error: null }),
        }),
      });
    }
  } catch (error) {
    // In test environment, ignore cleanup errors
    console.warn("Test cleanup warning:", (error as Error).message);
  }
}

async function seedTestData() {
  try {
    // Seed any required test data
    const supabase = Container.get("supabase") as any;

    // Mock the seed calls - they don't need to do anything in tests
    if (supabase && typeof supabase.from === "function") {
      // Mock successful seed responses
      supabase.from.mockReturnValue({
        insert: () => Promise.resolve({ data: [], error: null }),
      });
    }
  } catch (error) {
    // In test environment, ignore seeding errors
    console.warn("Test seeding warning:", (error as Error).message);
  }
}
