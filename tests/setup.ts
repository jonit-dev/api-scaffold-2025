import "reflect-metadata"; // CRITICAL: Must be imported first for TypeDI
import { Container } from "typedi";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { beforeAll, afterAll, afterEach } from "vitest";
import "./setup/redis.mock"; // Import centralized Redis mock
import { resetRedisMock, getRedisMockInstance } from "./setup/redis.mock";
import { initializeTestDatabase, cleanupDatabase, closeTestDatabase } from "./utils/setup.helpers";

// Load test environment variables
dotenv.config({ path: ".env.test" });

// Global test setup
beforeAll(async () => {
  // Initialize Prisma test database
  await initializeTestDatabase();
  
  // Setup Redis mock
  const mockRedis = getRedisMockInstance();
  Container.set("redis", mockRedis);
});

afterAll(async () => {
  // Cleanup after all tests
  await closeTestDatabase();
  Container.reset();
});

afterEach(async () => {
  // Reset mock data between tests
  resetRedisMock();
  
  // Clean up database between tests
  const prisma = Container.get("prisma") as PrismaClient;
  if (prisma) {
    await cleanupDatabase(prisma);
  }
  
  // Re-register Redis mock
  const mockRedis = getRedisMockInstance();
  Container.set("redis", mockRedis);
});

