# TASK-010: Testing Setup and Implementation

## Epic

Quality Assurance

## Story Points

8

## Priority

Medium

## Description

Set up comprehensive testing framework with unit tests, integration tests, and test utilities for the API scaffold using Vitest for modern, fast TypeScript testing.

## Acceptance Criteria

### ✅ Testing Framework Setup

- [ ] Configure Vitest testing framework
- [ ] Set up TypeScript support for tests (native)
- [ ] Configure test environment variables
- [ ] Set up test database configuration
- [ ] Create test scripts in package.json
- [ ] Configure code coverage reporting

### ✅ Unit Tests

- [ ] Create unit tests for all services
- [ ] Write unit tests for repositories
- [ ] Test utility functions
- [ ] Create unit tests for middleware
- [ ] Test authentication logic
- [ ] Add validation tests

### ✅ Integration Tests

- [ ] Create integration tests for controllers
- [ ] Test API endpoints end-to-end
- [ ] Test database operations
- [ ] Create authentication flow tests
- [ ] Test middleware integration
- [ ] Add error handling tests

### ✅ Test Utilities

- [ ] Create test data factories
- [ ] Set up database seeding for tests
- [ ] Create authentication helpers
- [ ] Implement request testing utilities
- [ ] Add mock implementations
- [ ] Create test cleanup utilities

### ✅ Test Coverage

- [ ] Achieve minimum 80% code coverage
- [ ] Set up coverage reporting
- [ ] Configure coverage thresholds
- [ ] Add coverage badges
- [ ] Create coverage reports

## Technical Requirements

### Testing Dependencies Installation

```bash
# Remove Jest dependencies
yarn remove jest ts-jest @types/jest

# Core testing framework (Vitest)
yarn add -D vitest @vitest/ui c8

# Testing utilities
yarn add -D supertest @types/supertest

# Additional testing utilities (if needed)
yarn add -D @vitest/coverage-v8
```

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: [
        "node_modules/",
        "dist/",
        "tests/",
        "src/server.ts",
        "src/config/**",
        "**/*.d.ts",
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@controllers": resolve(__dirname, "src/controllers"),
      "@services": resolve(__dirname, "src/services"),
      "@repositories": resolve(__dirname, "src/repositories"),
      "@models": resolve(__dirname, "src/models"),
      "@middlewares": resolve(__dirname, "src/middlewares"),
      "@config": resolve(__dirname, "src/config"),
      "@utils": resolve(__dirname, "src/utils"),
      "@exceptions": resolve(__dirname, "src/exceptions"),
      "@types": resolve(__dirname, "src/types"),
    },
  },
});
```

### Test Setup

```typescript
// tests/setup.ts
import "reflect-metadata"; // CRITICAL: Must be imported first for TypeDI
import { Container } from "typedi";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { beforeAll, afterAll, afterEach } from "vitest";

// Load test environment variables
dotenv.config({ path: ".env.test" });

// Global test setup
beforeAll(async () => {
  // Set up test Supabase client
  const supabaseUrl = process.env.TEST_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.TEST_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase credentials not found in test environment");
  }

  const testSupabase = createClient(supabaseUrl, supabaseKey);

  // Register test Supabase client in TypeDI container
  Container.set("supabase", testSupabase);

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
  // Cleanup after each test
  // Reset container instances for fresh test state
  Container.reset();
});

async function clearTestData() {
  // Clear test data from Supabase tables
  const supabase = Container.get("supabase");

  // Clear tables in dependency order
  await supabase.from("user_sessions").delete().neq("id", "");
  await supabase.from("users").delete().neq("id", "");
}

async function seedTestData() {
  // Seed any required test data
  const supabase = Container.get("supabase");

  // Add any default test data here
  // Example: Create test users, etc.
}
```

### TypeDI Testing Notes

- Always import `reflect-metadata` first in test setup
- Use `Container.reset()` to clear container state between tests
- Register test-specific services (like test database) in the container
- Use TypeDI's dependency injection in tests for consistency with application code

### Test Data Factory

```typescript
// tests/factories/user.factory.ts
import { UserEntity } from "@models/entities/user.entity";
import { UserRole, UserStatus } from "@models/enums";

export class UserFactory {
  static create(overrides: Partial<UserEntity> = {}): UserEntity {
    return {
      id: "123e4567-e89b-12d3-a456-426614174000",
      email: "test@example.com",
      first_name: "John",
      last_name: "Doe",
      password_hash: "$2b$12$hashedpassword",
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      email_verified: true,
      phone: "+1234567890",
      avatar_url: "https://example.com/avatar.jpg",
      last_login: new Date("2023-01-01"),
      created_at: new Date("2023-01-01"),
      updated_at: new Date("2023-01-01"),
      ...overrides,
    };
  }

  static createMany(
    count: number,
    overrides: Partial<UserEntity> = {}
  ): UserEntity[] {
    return Array.from({ length: count }, (_, index) =>
      this.create({
        id: `user-${index + 1}`,
        email: `user${index + 1}@example.com`,
        ...overrides,
      })
    );
  }
}
```

### Service Unit Test Example

```typescript
// tests/unit/services/user.service.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserService } from "@services/user.service";
import { UserRepository } from "@repositories/user.repository";
import { UserFactory } from "../../factories/user.factory";
import { NotFoundException, ValidationException } from "@exceptions";

describe("UserService", () => {
  let userService: UserService;
  let userRepository: MockedUserRepository;

  type MockedUserRepository = {
    [K in keyof UserRepository]: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    userRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      findWithPagination: vi.fn(),
    } as MockedUserRepository;

    userService = new UserService(userRepository as any);
  });

  describe("findById", () => {
    it("should return user when found", async () => {
      const user = UserFactory.create();
      userRepository.findById.mockResolvedValue(user);

      const result = await userService.findById(user.id);

      expect(result).toEqual(
        expect.objectContaining({
          id: user.id,
          email: user.email,
          first_name: user.first_name,
        })
      );
      expect(userRepository.findById).toHaveBeenCalledWith(user.id);
    });

    it("should throw NotFoundException when user not found", async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(userService.findById("non-existent-id")).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("create", () => {
    it("should create user successfully", async () => {
      const createUserDto = {
        email: "new@example.com",
        first_name: "New",
        last_name: "User",
        password: "password123",
      };
      const createdUser = UserFactory.create(createUserDto);

      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(createdUser);

      const result = await userService.create(createUserDto);

      expect(result.email).toBe(createUserDto.email);
      expect(userRepository.create).toHaveBeenCalled();
    });

    it("should throw ValidationException for duplicate email", async () => {
      const createUserDto = {
        email: "existing@example.com",
        first_name: "New",
        last_name: "User",
        password: "password123",
      };
      const existingUser = UserFactory.create();

      userRepository.findByEmail.mockResolvedValue(existingUser);

      await expect(userService.create(createUserDto)).rejects.toThrow(
        ValidationException
      );
    });
  });
});
```

### Controller Integration Test Example

```typescript
// tests/integration/auth.controller.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "@/server";
import { UserFactory } from "../factories/user.factory";

describe("Auth Controller", () => {
  describe("POST /api/auth/login", () => {
    it("should login successfully with valid credentials", async () => {
      const user = UserFactory.create();
      // Seed user in test database
      await seedUser(user);

      const response = await request(app).post("/api/auth/login").send({
        email: user.email,
        password: "password123",
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("tokens");
      expect(response.body.data.tokens).toHaveProperty("accessToken");
    });

    it("should return 401 for invalid credentials", async () => {
      const response = await request(app).post("/api/auth/login").send({
        email: "invalid@example.com",
        password: "wrongpassword",
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return user profile when authenticated", async () => {
      const user = UserFactory.create();
      const token = generateJWT(user);

      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(user.id);
    });

    it("should return 401 when not authenticated", async () => {
      const response = await request(app).get("/api/auth/me");

      expect(response.status).toBe(401);
    });
  });
});
```

### Test Utilities

```typescript
// tests/utils/auth.helpers.ts
import jwt from "jsonwebtoken";
import { UserEntity } from "@models/entities/user.entity";
import { config } from "@config/app";

export function generateJWT(user: UserEntity): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwt.secret,
    { expiresIn: "1h" }
  );
}

export function createAuthenticatedRequest(user: UserEntity) {
  return {
    headers: {
      authorization: `Bearer ${generateJWT(user)}`,
    },
  };
}
```

## Definition of Done

- [ ] Vitest configuration complete and working
- [ ] Unit tests written for all services
- [ ] Integration tests for all controllers
- [ ] Test utilities and factories created
- [ ] Code coverage above 80%
- [ ] All tests passing
- [ ] Test scripts configured in package.json
- [ ] Documentation for testing approach

## Testing Strategy

- [ ] Run unit tests in isolation
- [ ] Test integration with real database
- [ ] Verify error handling scenarios
- [ ] Test authentication and authorization
- [ ] Check edge cases and boundary conditions
- [ ] Verify mocking works correctly
- [ ] Test cleanup and setup procedures

## Dependencies

- TASK-009: User Service and Controller Implementation
- TASK-008: Authentication Controller and API Endpoints

## Notes

- Keep tests fast and reliable
- Use proper mocking for external dependencies
- Ensure test data isolation
- Document testing conventions
- Consider adding e2e tests for critical flows
