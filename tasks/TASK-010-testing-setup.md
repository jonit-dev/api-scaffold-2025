# TASK-010: Testing Setup and Implementation

## Epic
Quality Assurance

## Story Points
8

## Priority
Medium

## Description
Set up comprehensive testing framework with unit tests, integration tests, and test utilities for the API scaffold.

## Acceptance Criteria

### ✅ Testing Framework Setup
- [ ] Configure Jest testing framework
- [ ] Set up TypeScript support for tests
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
# Core testing framework
npm install -D jest ts-jest @types/jest

# Testing utilities
npm install -D supertest @types/supertest

# Additional testing utilities
npm install -D jest-extended
npm install -D @jest/globals

# For mocking and test utilities (if needed)
npm install -D jest-mock-extended
```

### Jest Configuration
```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
    '!src/config/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@repositories/(.*)$': '<rootDir>/src/repositories/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
  },
};
```

### Test Setup
```typescript
// tests/setup.ts
import { Container } from 'typedi';
import { createConnection } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test setup
beforeAll(async () => {
  // Set up test database
  const testDb = createConnection({
    host: process.env.TEST_DB_HOST,
    port: parseInt(process.env.TEST_DB_PORT || '5432'),
    database: process.env.TEST_DB_NAME,
    username: process.env.TEST_DB_USER,
    password: process.env.TEST_DB_PASSWORD,
  });

  // Clear and seed test database
  await testDb.query('TRUNCATE TABLE users CASCADE');
  await seedTestData();
});

afterAll(async () => {
  // Cleanup after all tests
  await Container.reset();
});

afterEach(async () => {
  // Cleanup after each test
  jest.clearAllMocks();
});
```

### Test Data Factory
```typescript
// tests/factories/user.factory.ts
import { UserEntity } from '@models/entities/user.entity';
import { UserRole, UserStatus } from '@models/enums';

export class UserFactory {
  static create(overrides: Partial<UserEntity> = {}): UserEntity {
    return {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Doe',
      password_hash: '$2b$12$hashedpassword',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      email_verified: true,
      phone: '+1234567890',
      avatar_url: 'https://example.com/avatar.jpg',
      last_login: new Date('2023-01-01'),
      created_at: new Date('2023-01-01'),
      updated_at: new Date('2023-01-01'),
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<UserEntity> = {}): UserEntity[] {
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
import { UserService } from '@services/user.service';
import { UserRepository } from '@repositories/user.repository';
import { UserFactory } from '../../factories/user.factory';
import { NotFoundException, ValidationException } from '@exceptions';

describe('UserService', () => {
  let userService: UserService;
  let userRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    userRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      findWithPagination: jest.fn(),
    } as any;

    userService = new UserService(userRepository);
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const user = UserFactory.create();
      userRepository.findById.mockResolvedValue(user);

      const result = await userService.findById(user.id);

      expect(result).toEqual(expect.objectContaining({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
      }));
      expect(userRepository.findById).toHaveBeenCalledWith(user.id);
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(userService.findById('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create user successfully', async () => {
      const createUserDto = {
        email: 'new@example.com',
        first_name: 'New',
        last_name: 'User',
        password: 'password123',
      };
      const createdUser = UserFactory.create(createUserDto);

      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(createdUser);

      const result = await userService.create(createUserDto);

      expect(result.email).toBe(createUserDto.email);
      expect(userRepository.create).toHaveBeenCalled();
    });

    it('should throw ValidationException for duplicate email', async () => {
      const createUserDto = {
        email: 'existing@example.com',
        first_name: 'New',
        last_name: 'User',
        password: 'password123',
      };
      const existingUser = UserFactory.create();

      userRepository.findByEmail.mockResolvedValue(existingUser);

      await expect(userService.create(createUserDto)).rejects.toThrow(ValidationException);
    });
  });
});
```

### Controller Integration Test Example
```typescript
// tests/integration/auth.controller.test.ts
import request from 'supertest';
import { app } from '@/server';
import { UserFactory } from '../factories/user.factory';

describe('Auth Controller', () => {
  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const user = UserFactory.create();
      // Seed user in test database
      await seedUser(user);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('tokens');
      expect(response.body.data.tokens).toHaveProperty('accessToken');
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile when authenticated', async () => {
      const user = UserFactory.create();
      const token = generateJWT(user);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(user.id);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });
  });
});
```

### Test Utilities
```typescript
// tests/utils/auth.helpers.ts
import jwt from 'jsonwebtoken';
import { UserEntity } from '@models/entities/user.entity';
import { config } from '@config/app';

export function generateJWT(user: UserEntity): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwt.secret,
    { expiresIn: '1h' }
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
- [ ] Jest configuration complete and working
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