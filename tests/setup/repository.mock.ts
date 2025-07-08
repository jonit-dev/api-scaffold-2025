import { vi } from "vitest";
import { Container } from "typedi";
import { UserRepository } from "../../src/repositories/user.repository";
import { PaymentRepository } from "../../src/repositories/payment.repository";
import { SubscriptionRepository } from "../../src/repositories/subscription.repository";

// Mock UserRepository
export const createMockUserRepository = () => ({
  findById: vi.fn().mockResolvedValue(null),
  findByEmail: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({
    id: "test-user-id",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
  }),
  update: vi.fn().mockResolvedValue({
    id: "test-user-id",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
  }),
  delete: vi.fn().mockResolvedValue(undefined),
  findByFilter: vi.fn().mockResolvedValue([]),
  findUnsubscribedUsers: vi.fn().mockResolvedValue([]),
  updateEmailUnsubscribed: vi.fn().mockResolvedValue({
    id: "test-user-id",
    emailUnsubscribed: true,
  }),
});

// Mock PaymentRepository
export const createMockPaymentRepository = () => ({
  findById: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({
    id: "test-payment-id",
    amount: 2000,
    currency: "usd",
    status: "succeeded",
  }),
  update: vi.fn().mockResolvedValue({
    id: "test-payment-id",
    amount: 2000,
    currency: "usd",
    status: "succeeded",
  }),
  findByFilter: vi.fn().mockResolvedValue([]),
  delete: vi.fn().mockResolvedValue(undefined),
});

// Mock SubscriptionRepository
export const createMockSubscriptionRepository = () => ({
  findById: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({
    id: "test-subscription-id",
    status: "active",
    userId: "test-user-id",
  }),
  update: vi.fn().mockResolvedValue({
    id: "test-subscription-id",
    status: "active",
    userId: "test-user-id",
  }),
  findByUserId: vi.fn().mockResolvedValue([]),
  delete: vi.fn().mockResolvedValue(undefined),
  findByFilter: vi.fn().mockResolvedValue([]),
});

// Register repository mocks
export const registerRepositoryMocks = () => {
  Container.set(UserRepository, createMockUserRepository());
  // Note: PaymentRepository and SubscriptionRepository are registered in stripe.mock.ts
  // to avoid conflicts with Stripe service mocks
};

// Reset repository mocks
export const resetRepositoryMocks = () => {
  const userRepo = Container.get(UserRepository) as any;

  [userRepo].forEach((repo) => {
    if (repo) {
      Object.values(repo).forEach((fn: any) => {
        if (fn && typeof fn.mockClear === "function") {
          fn.mockClear();
        }
      });
    }
  });
};
