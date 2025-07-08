import "reflect-metadata"; // CRITICAL: Must be imported first for TypeDI
import { Container } from "typedi";
import { PrismaClient } from "../node_modules/.prisma/test-client";
import dotenv from "dotenv";
import { beforeAll, afterAll, afterEach } from "vitest";
import "./setup/redis.mock"; // Import centralized Redis mock
import { resetRedisMock, getRedisMockInstance } from "./setup/redis.mock";
import { registerStripeMocks, resetStripeMocks } from "./setup/stripe.mock";
import { registerEmailMocks, resetEmailMocks } from "./setup/email.mock";
import { registerHealthMocks, resetHealthMocks } from "./setup/health.mock";
import {
  registerRepositoryMocks,
  resetRepositoryMocks,
} from "./setup/repository.mock";
import { registerUserMocks, resetUserMocks } from "./setup/user.mock";
import {
  registerTemplateMocks,
  resetTemplateMocks,
} from "./setup/template.mock";
import {
  initializeTestDatabase,
  cleanupDatabase,
  closeTestDatabase,
} from "./utils/setup.helpers";

// Load test environment variables
dotenv.config({ path: ".env.test", quiet: true });

// Global test setup
beforeAll(async () => {
  // Initialize Prisma test database
  await initializeTestDatabase();

  // Setup Redis mock
  const mockRedis = getRedisMockInstance();
  Container.set("redis", mockRedis);

  // Setup Stripe mocks
  registerStripeMocks();

  // Setup Email mocks
  registerEmailMocks();

  // Setup Health mocks
  registerHealthMocks();

  // Setup Repository mocks
  registerRepositoryMocks();

  // Setup User mocks
  registerUserMocks();

  // Setup Template mocks
  registerTemplateMocks();
});

afterAll(async () => {
  // Cleanup after all tests
  await closeTestDatabase();
  Container.reset();
});

afterEach(async () => {
  // Reset mock data between tests
  resetRedisMock();
  resetStripeMocks();
  resetEmailMocks();
  resetHealthMocks();
  resetRepositoryMocks();
  resetUserMocks();
  resetTemplateMocks();

  // Clean up database between tests
  const prisma = Container.get("prisma") as PrismaClient;
  if (prisma) {
    await cleanupDatabase(prisma);
  }

  // Re-register Redis mock
  const mockRedis = getRedisMockInstance();
  Container.set("redis", mockRedis);

  // Re-register Stripe mocks
  registerStripeMocks();

  // Re-register Email mocks
  registerEmailMocks();

  // Re-register Health mocks
  registerHealthMocks();

  // Re-register Repository mocks
  registerRepositoryMocks();

  // Re-register User mocks
  registerUserMocks();

  // Re-register Template mocks
  registerTemplateMocks();
});
