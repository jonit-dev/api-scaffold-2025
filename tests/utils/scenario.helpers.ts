import { PrismaClient } from "@prisma/client";
import { Container } from "typedi";
import { UserRole } from "../../src/models/enums/user-roles.enum";
import { UserStatus } from "../../src/models/enums/user-status.enum";
import { PaymentStatus } from "../../src/types/stripe.types";

export interface ITestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
}

export const createITestUser = async (
  overrides: Partial<ITestUser> = {},
): Promise<ITestUser> => {
  const prisma = Container.get("prisma") as PrismaClient;

  const userData = {
    email: `test-${Date.now()}@example.com`,
    firstName: "Test",
    lastName: "User",
    passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz", // bcrypt hash for "password"
    role: UserRole.User,
    status: UserStatus.Active,
    emailVerified: true,
    ...overrides,
  };

  const user = await prisma.user.create({
    data: userData,
  });

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role as UserRole,
    status: user.status as UserStatus,
  };
};

export const createTestPayment = async (userId: string, overrides = {}) => {
  const prisma = Container.get("prisma") as PrismaClient;

  const paymentData = {
    stripePaymentIntentId: `pi_test_${Date.now()}`,
    userId,
    stripeCustomerId: `cus_test_${Date.now()}`,
    amount: 2000, // $20.00
    currency: "usd",
    status: PaymentStatus.Succeeded,
    ...overrides,
  };

  return prisma.payment.create({
    data: paymentData,
  });
};

export const createTestWebhookEvent = async (overrides = {}) => {
  const prisma = Container.get("prisma") as PrismaClient;

  const eventData = {
    stripeEventId: `evt_test_${Date.now()}`,
    eventType: "payment_intent.succeeded",
    processed: false,
    payload: { test: "data" },
    retryCount: 0,
    ...overrides,
  };

  return prisma.webhookEvent.create({
    data: eventData,
  });
};
