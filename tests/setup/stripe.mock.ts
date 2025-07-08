import { vi } from "vitest";
import { Container } from "typedi";
import { StripeCustomerService } from "../../src/services/stripe-customer.service";
import { StripePaymentService } from "../../src/services/stripe-payment.service";
import { StripeSubscriptionService } from "../../src/services/stripe-subscription.service";
import { StripeWebhookService } from "../../src/services/stripe-webhook.service";
import { StripeService } from "../../src/services/stripe.service";
import { PaymentRepository } from "../../src/repositories/payment.repository";
import { SubscriptionRepository } from "../../src/repositories/subscription.repository";

// Mock Stripe services for testing
export const createMockStripeCustomerService = () => ({
  createCustomer: vi.fn().mockResolvedValue({
    id: "cus_test123",
    email: "test@example.com",
    name: "Test Customer",
    created: Date.now(),
  }),
  syncCustomerWithUser: vi.fn().mockResolvedValue({
    id: "cus_test123",
    email: "test@example.com",
    name: "Test Customer",
  }),
  getCustomer: vi.fn().mockResolvedValue({
    id: "cus_test123",
    email: "test@example.com",
    name: "Test Customer",
    phone: "+1234567890",
    created: Date.now(),
  }),
  getCustomerPaymentMethods: vi.fn().mockResolvedValue([
    {
      id: "pm_test123",
      type: "card",
      card: {
        brand: "visa",
        last4: "4242",
      },
    },
  ]),
});

export const createMockStripePaymentService = () => ({
  createPaymentIntent: vi.fn().mockResolvedValue({
    id: "pi_test123",
    client_secret: "pi_test123_secret",
    status: "requires_payment_method",
    amount: 2000,
    currency: "usd",
  }),
  confirmPaymentIntent: vi.fn().mockResolvedValue({
    id: "pi_test123",
    status: "succeeded",
    amount: 2000,
    currency: "usd",
  }),
  createRefund: vi.fn().mockResolvedValue({
    id: "re_test123",
    amount: 1000,
    status: "succeeded",
    reason: "requested_by_customer",
  }),
  createSetupIntent: vi.fn().mockResolvedValue({
    id: "seti_test123",
    client_secret: "seti_test123_secret",
    status: "requires_payment_method",
  }),
});

export const createMockStripeSubscriptionService = () => ({
  createSubscription: vi.fn().mockResolvedValue({
    id: "sub_test123",
    status: "active",
    current_period_start: Date.now(),
    current_period_end: Date.now() + 30 * 24 * 60 * 60 * 1000,
    customer: "cus_test123",
  }),
  getSubscription: vi.fn().mockResolvedValue({
    id: "sub_test123",
    status: "active",
    current_period_start: Date.now(),
    current_period_end: Date.now() + 30 * 24 * 60 * 60 * 1000,
    customer: "cus_test123",
    items: {
      data: [
        {
          id: "si_test123",
          price: {
            id: "price_test123",
          },
        },
      ],
    },
  }),
  cancelSubscription: vi.fn().mockResolvedValue({
    id: "sub_test123",
    status: "canceled",
    canceled_at: Date.now(),
    cancel_at_period_end: false,
  }),
  pauseSubscription: vi.fn().mockResolvedValue({
    id: "sub_test123",
    status: "paused",
    pause_collection: {
      behavior: "mark_uncollectible",
    },
  }),
  resumeSubscription: vi.fn().mockResolvedValue({
    id: "sub_test123",
    status: "active",
  }),
  listProducts: vi.fn().mockResolvedValue({
    data: [
      {
        id: "prod_test123",
        name: "Test Product",
        active: true,
      },
    ],
  }),
  listPrices: vi.fn().mockResolvedValue({
    data: [
      {
        id: "price_test123",
        unit_amount: 2000,
        currency: "usd",
        active: true,
      },
    ],
  }),
});

export const createMockStripeWebhookService = () => ({
  processWebhook: vi.fn().mockResolvedValue(undefined),
});

export const createMockStripeService = () => ({
  getStripeInstance: vi.fn().mockReturnValue({
    customers: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
      list: vi.fn(),
      del: vi.fn(),
    },
    paymentIntents: {
      create: vi.fn(),
      confirm: vi.fn(),
      retrieve: vi.fn(),
    },
    refunds: {
      create: vi.fn(),
    },
    subscriptions: {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    },
  }),
});

export const createMockPaymentRepository = () => ({
  findById: vi.fn().mockResolvedValue({
    id: "pay_test123",
    stripePaymentIntentId: "pi_test123",
    amount: 2000,
    currency: "usd",
    status: "succeeded",
    userId: "user_test123",
  }),
  findByUserId: vi.fn().mockResolvedValue([
    {
      id: "pay_test123",
      stripePaymentIntentId: "pi_test123",
      amount: 2000,
      currency: "usd",
      status: "succeeded",
      userId: "user_test123",
    },
  ]),
  create: vi.fn().mockResolvedValue({
    id: "pay_test123",
    stripePaymentIntentId: "pi_test123",
    amount: 2000,
    currency: "usd",
    status: "succeeded",
    userId: "user_test123",
  }),
  update: vi.fn().mockResolvedValue({
    id: "pay_test123",
    stripePaymentIntentId: "pi_test123",
    amount: 2000,
    currency: "usd",
    status: "succeeded",
    userId: "user_test123",
  }),
});

export const createMockSubscriptionRepository = () => ({
  findById: vi.fn().mockResolvedValue({
    id: "sub_test123",
    stripeSubscriptionId: "sub_stripe123",
    status: "active",
    userId: "user_test123",
  }),
  findByUserId: vi.fn().mockResolvedValue([
    {
      id: "sub_test123",
      stripeSubscriptionId: "sub_stripe123",
      status: "active",
      userId: "user_test123",
    },
  ]),
  create: vi.fn().mockResolvedValue({
    id: "sub_test123",
    stripeSubscriptionId: "sub_stripe123",
    status: "active",
    userId: "user_test123",
  }),
  update: vi.fn().mockResolvedValue({
    id: "sub_test123",
    stripeSubscriptionId: "sub_stripe123",
    status: "canceled",
    userId: "user_test123",
  }),
});

// Register mock services in container
export const registerStripeMocks = () => {
  Container.set(StripeService, createMockStripeService());
  Container.set(StripeCustomerService, createMockStripeCustomerService());
  Container.set(StripePaymentService, createMockStripePaymentService());
  Container.set(
    StripeSubscriptionService,
    createMockStripeSubscriptionService(),
  );
  Container.set(StripeWebhookService, createMockStripeWebhookService());
  Container.set(PaymentRepository, createMockPaymentRepository());
  Container.set(SubscriptionRepository, createMockSubscriptionRepository());
};

// Reset stripe mocks
export const resetStripeMocks = () => {
  try {
    const stripeService = Container.get(StripeService) as any;
    const customerService = Container.get(StripeCustomerService) as any;
    const paymentService = Container.get(StripePaymentService) as any;
    const subscriptionService = Container.get(StripeSubscriptionService) as any;
    const webhookService = Container.get(StripeWebhookService) as any;

    [
      stripeService,
      customerService,
      paymentService,
      subscriptionService,
      webhookService,
    ].forEach((service) => {
      if (service) {
        Object.values(service).forEach((fn: any) => {
          if (fn && typeof fn.mockClear === "function") {
            fn.mockClear();
          }
        });
      }
    });
  } catch (error) {
    // Ignore errors if services are not registered yet
    console.warn("Warning: Could not reset Stripe mocks:", error);
  }
};
