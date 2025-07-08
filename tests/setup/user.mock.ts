import { vi } from "vitest";
import { Container } from "typedi";
import { UserService } from "../../src/services/user.service";
import { AuthService } from "../../src/services/auth.service";

// Mock UserService
export const createMockUserService = () => ({
  findById: vi.fn().mockResolvedValue({
    id: "test-user-id",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    fullName: "Test User",
    role: "User",
    status: "Active",
  }),
  findByEmail: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({
    id: "test-user-id",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    role: "User",
    status: "Active",
  }),
  update: vi.fn().mockResolvedValue({
    id: "test-user-id",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    role: "User",
    status: "Active",
    stripeCustomerId: "cus_test123",
  }),
  delete: vi.fn().mockResolvedValue(undefined),
  findAll: vi.fn().mockResolvedValue([]),
});

// Mock AuthService
export const createMockAuthService = () => ({
  register: vi.fn().mockResolvedValue({
    user: {
      id: "test-user-id",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
    },
    token: "test-jwt-token",
  }),
  login: vi.fn().mockResolvedValue({
    user: {
      id: "test-user-id",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
    },
    token: "test-jwt-token",
  }),
  verifyToken: vi.fn().mockResolvedValue({
    id: "test-user-id",
    email: "test@example.com",
    role: "User",
  }),
  verifyEmail: vi.fn().mockResolvedValue(true),
  requestPasswordReset: vi.fn().mockResolvedValue(true),
  resetPassword: vi.fn().mockResolvedValue(true),
});

// Register user-related mocks
export const registerUserMocks = () => {
  Container.set(UserService, createMockUserService());
  Container.set(AuthService, createMockAuthService());
};

// Reset user mocks
export const resetUserMocks = () => {
  const userService = Container.get(UserService) as any;
  const authService = Container.get(AuthService) as any;

  [userService, authService].forEach((service) => {
    if (service) {
      Object.values(service).forEach((fn: any) => {
        if (fn && typeof fn.mockClear === "function") {
          fn.mockClear();
        }
      });
    }
  });
};
