# Stripe Testing Guide

## Overview

This guide covers comprehensive testing strategies for Stripe integration, including unit tests, integration tests, webhook testing, and end-to-end testing scenarios.

## Testing Environment Setup

### Test Configuration

```typescript
// src/config/test.ts
export const testConfig = {
  stripe: {
    publishableKey: "pk_test_51234567890abcdef...",
    secretKey: "sk_test_51234567890abcdef...",
    webhookSecret: "whsec_test_1234567890abcdef...",
    apiVersion: "2023-10-16" as const,
  },
  database: {
    url: "postgresql://test:test@localhost:5432/test_db",
  },
  server: {
    port: 3001,
  },
};
```

### Test Database Setup

```sql
-- Create test database
CREATE DATABASE test_db;

-- Run migrations for test environment
npm run migrate:test
```

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/types/**"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapping: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
```

## Test Data and Mocks

### Test Cards

Stripe provides test card numbers for different scenarios:

```typescript
// tests/fixtures/test-cards.ts
export const testCards = {
  // Successful payments
  visa: "4242424242424242",
  visaDebit: "4000056655665556",
  mastercard: "5555555555554444",
  amex: "378282246310005",

  // Declined cards
  genericDeclined: "4000000000000002",
  insufficientFunds: "4000000000009995",
  lostCard: "4000000000009987",
  stolenCard: "4000000000009979",
  expiredCard: "4000000000000069",
  incorrectCvc: "4000000000000127",
  processingError: "4000000000000119",

  // 3D Secure cards
  threeDSecureRequired: "4000002500003155",
  threeDSecureOptional: "4000002760003184",

  // International cards
  alwaysDeclineIndia: "4000000000000036",
  alwaysDeclineBrazil: "4000000000000044",
};

export const testPaymentMethods = {
  validCard: {
    type: "card",
    card: {
      number: testCards.visa,
      exp_month: 12,
      exp_year: 2025,
      cvc: "123",
    },
  },
  declinedCard: {
    type: "card",
    card: {
      number: testCards.genericDeclined,
      exp_month: 12,
      exp_year: 2025,
      cvc: "123",
    },
  },
};
```

### Test Customers

```typescript
// tests/fixtures/test-customers.ts
export const testCustomers = {
  valid: {
    email: "test@example.com",
    name: "Test Customer",
    phone: "+1234567890",
    metadata: {
      test: "true",
    },
  },
  withoutName: {
    email: "noname@example.com",
  },
  corporate: {
    email: "corp@example.com",
    name: "Corporate Customer",
    metadata: {
      type: "corporate",
      test: "true",
    },
  },
};
```

### Mock Stripe Service

```typescript
// tests/mocks/stripe.mock.ts
import { jest } from "@jest/globals";

export const mockStripeService = {
  customers: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
    del: jest.fn(),
    list: jest.fn(),
  },
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn(),
    confirm: jest.fn(),
    capture: jest.fn(),
    cancel: jest.fn(),
  },
  subscriptions: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
    del: jest.fn(),
    list: jest.fn(),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
};

// Mock Stripe constructor
jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => mockStripeService);
});
```

## Unit Tests

### Service Layer Tests

#### Payment Service Tests

```typescript
// src/services/__tests__/stripe-payment.service.test.ts
import { StripePaymentService } from "../stripe-payment.service";
import { mockStripeService } from "../../tests/mocks/stripe.mock";
import { testCards } from "../../tests/fixtures/test-cards";

describe("StripePaymentService", () => {
  let paymentService: StripePaymentService;

  beforeEach(() => {
    paymentService = new StripePaymentService();
    jest.clearAllMocks();
  });

  describe("createPaymentIntent", () => {
    it("should create payment intent with valid data", async () => {
      const mockPaymentIntent = {
        id: "pi_1234567890",
        amount: 2000,
        currency: "usd",
        status: "requires_payment_method",
        client_secret: "pi_1234567890_secret_abc123",
      };

      mockStripeService.paymentIntents.create.mockResolvedValue(
        mockPaymentIntent,
      );

      const result = await paymentService.createPaymentIntent({
        amount: 2000,
        currency: "usd",
        customerId: "cus_1234567890",
      });

      expect(mockStripeService.paymentIntents.create).toHaveBeenCalledWith({
        amount: 2000,
        currency: "usd",
        customer: "cus_1234567890",
      });
      expect(result).toEqual(mockPaymentIntent);
    });

    it("should throw error for invalid amount", async () => {
      await expect(
        paymentService.createPaymentIntent({
          amount: 0,
          currency: "usd",
          customerId: "cus_1234567890",
        }),
      ).rejects.toThrow("Amount must be greater than 0");
    });

    it("should handle Stripe API errors", async () => {
      mockStripeService.paymentIntents.create.mockRejectedValue(
        new Error("Invalid customer ID"),
      );

      await expect(
        paymentService.createPaymentIntent({
          amount: 2000,
          currency: "usd",
          customerId: "invalid_customer",
        }),
      ).rejects.toThrow("Invalid customer ID");
    });
  });

  describe("confirmPaymentIntent", () => {
    it("should confirm payment intent successfully", async () => {
      const mockConfirmedPayment = {
        id: "pi_1234567890",
        status: "succeeded",
        amount: 2000,
        currency: "usd",
      };

      mockStripeService.paymentIntents.confirm.mockResolvedValue(
        mockConfirmedPayment,
      );

      const result = await paymentService.confirmPaymentIntent(
        "pi_1234567890",
        "pm_1234567890",
      );

      expect(mockStripeService.paymentIntents.confirm).toHaveBeenCalledWith(
        "pi_1234567890",
        { payment_method: "pm_1234567890" },
      );
      expect(result).toEqual(mockConfirmedPayment);
    });
  });

  describe("refundPayment", () => {
    it("should create refund successfully", async () => {
      const mockRefund = {
        id: "re_1234567890",
        amount: 2000,
        currency: "usd",
        status: "succeeded",
        payment_intent: "pi_1234567890",
      };

      mockStripeService.refunds = {
        create: jest.fn().mockResolvedValue(mockRefund),
      };

      const result = await paymentService.refundPayment("pi_1234567890", 2000);

      expect(mockStripeService.refunds.create).toHaveBeenCalledWith({
        payment_intent: "pi_1234567890",
        amount: 2000,
      });
      expect(result).toEqual(mockRefund);
    });
  });
});
```

#### Customer Service Tests

```typescript
// src/services/__tests__/stripe-customer.service.test.ts
import { StripeCustomerService } from "../stripe-customer.service";
import { mockStripeService } from "../../tests/mocks/stripe.mock";
import { testCustomers } from "../../tests/fixtures/test-customers";

describe("StripeCustomerService", () => {
  let customerService: StripeCustomerService;

  beforeEach(() => {
    customerService = new StripeCustomerService();
    jest.clearAllMocks();
  });

  describe("createCustomer", () => {
    it("should create customer with valid data", async () => {
      const mockCustomer = {
        id: "cus_1234567890",
        email: "test@example.com",
        name: "Test Customer",
        created: 1234567890,
      };

      mockStripeService.customers.create.mockResolvedValue(mockCustomer);

      const result = await customerService.createCustomer(testCustomers.valid);

      expect(mockStripeService.customers.create).toHaveBeenCalledWith(
        testCustomers.valid,
      );
      expect(result).toEqual(mockCustomer);
    });

    it("should throw error for invalid email", async () => {
      await expect(
        customerService.createCustomer({
          email: "invalid-email",
          name: "Test Customer",
        }),
      ).rejects.toThrow("Invalid email format");
    });
  });

  describe("updateCustomer", () => {
    it("should update customer successfully", async () => {
      const mockUpdatedCustomer = {
        id: "cus_1234567890",
        email: "test@example.com",
        name: "Updated Name",
      };

      mockStripeService.customers.update.mockResolvedValue(mockUpdatedCustomer);

      const result = await customerService.updateCustomer("cus_1234567890", {
        name: "Updated Name",
      });

      expect(mockStripeService.customers.update).toHaveBeenCalledWith(
        "cus_1234567890",
        { name: "Updated Name" },
      );
      expect(result).toEqual(mockUpdatedCustomer);
    });
  });
});
```

#### Webhook Service Tests

```typescript
// src/services/__tests__/stripe-webhook.service.test.ts
import { StripeWebhookService } from "../stripe-webhook.service";
import { mockStripeService } from "../../tests/mocks/stripe.mock";

describe("StripeWebhookService", () => {
  let webhookService: StripeWebhookService;

  beforeEach(() => {
    webhookService = new StripeWebhookService();
    jest.clearAllMocks();
  });

  describe("processWebhook", () => {
    it("should process valid webhook", async () => {
      const mockEvent = {
        id: "evt_1234567890",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_1234567890",
            status: "succeeded",
            amount: 2000,
          },
        },
      };

      const payload = Buffer.from(JSON.stringify(mockEvent));
      const signature = "valid_signature";

      mockStripeService.webhooks.constructEvent.mockReturnValue(mockEvent);

      const spy = jest.spyOn(
        webhookService as any,
        "handlePaymentIntentSucceeded",
      );
      spy.mockResolvedValue(undefined);

      await webhookService.processWebhook(payload, signature);

      expect(mockStripeService.webhooks.constructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        expect.any(String),
      );
      expect(spy).toHaveBeenCalledWith(mockEvent);
    });

    it("should throw error for invalid signature", async () => {
      const payload = Buffer.from("invalid payload");
      const signature = "invalid_signature";

      mockStripeService.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      await expect(
        webhookService.processWebhook(payload, signature),
      ).rejects.toThrow("Webhook signature verification failed");
    });
  });

  describe("handlePaymentIntentSucceeded", () => {
    it("should handle payment success event", async () => {
      const mockEvent = {
        id: "evt_1234567890",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_1234567890",
            status: "succeeded",
            amount: 2000,
            customer: "cus_1234567890",
          },
        },
      };

      const updateSpy = jest.spyOn(
        webhookService as any,
        "updatePaymentStatus",
      );
      const emailSpy = jest.spyOn(
        webhookService as any,
        "sendPaymentConfirmation",
      );

      updateSpy.mockResolvedValue(undefined);
      emailSpy.mockResolvedValue(undefined);

      await (webhookService as any).handlePaymentIntentSucceeded(mockEvent);

      expect(updateSpy).toHaveBeenCalledWith("pi_1234567890", "succeeded");
      expect(emailSpy).toHaveBeenCalledWith(mockEvent.data.object);
    });
  });
});
```

### Controller Tests

```typescript
// src/controllers/__tests__/stripe-payment.controller.test.ts
import request from "supertest";
import { app } from "../../app";
import { StripePaymentService } from "../../services/stripe-payment.service";

// Mock the service
jest.mock("../../services/stripe-payment.service");

describe("StripePaymentController", () => {
  let mockPaymentService: jest.Mocked<StripePaymentService>;

  beforeEach(() => {
    mockPaymentService =
      new StripePaymentService() as jest.Mocked<StripePaymentService>;
    jest.clearAllMocks();
  });

  describe("POST /api/payments/payment-intent", () => {
    it("should create payment intent successfully", async () => {
      const mockPaymentIntent = {
        id: "pi_1234567890",
        amount: 2000,
        currency: "usd",
        status: "requires_payment_method",
        client_secret: "pi_1234567890_secret_abc123",
      };

      mockPaymentService.createPaymentIntent.mockResolvedValue(
        mockPaymentIntent as any,
      );

      const response = await request(app)
        .post("/api/payments/payment-intent")
        .set("Authorization", "Bearer valid_jwt_token")
        .send({
          amount: 2000,
          currency: "usd",
          customerId: "cus_1234567890",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPaymentIntent);
    });

    it("should return 400 for invalid request", async () => {
      const response = await request(app)
        .post("/api/payments/payment-intent")
        .set("Authorization", "Bearer valid_jwt_token")
        .send({
          amount: "invalid",
          currency: "usd",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it("should return 401 for missing authentication", async () => {
      const response = await request(app)
        .post("/api/payments/payment-intent")
        .send({
          amount: 2000,
          currency: "usd",
        });

      expect(response.status).toBe(401);
    });
  });
});
```

## Integration Tests

### Payment Flow Integration Test

```typescript
// tests/integration/payment-flow.test.ts
import request from "supertest";
import { app } from "../../src/app";
import { testConfig } from "../../src/config/test";
import { testCards } from "../fixtures/test-cards";

describe("Payment Flow Integration", () => {
  let authToken: string;
  let customerId: string;

  beforeAll(async () => {
    // Setup test user and get auth token
    authToken = await setupTestUser();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  describe("Complete payment flow", () => {
    it("should complete successful payment flow", async () => {
      // 1. Create customer
      const customerResponse = await request(app)
        .post("/api/customers")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          email: "test@example.com",
          name: "Test Customer",
        });

      expect(customerResponse.status).toBe(200);
      customerId = customerResponse.body.data.id;

      // 2. Create payment intent
      const paymentIntentResponse = await request(app)
        .post("/api/payments/payment-intent")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          amount: 2000,
          currency: "usd",
          customerId,
        });

      expect(paymentIntentResponse.status).toBe(200);
      const paymentIntentId = paymentIntentResponse.body.data.id;

      // 3. Confirm payment (simulate successful payment)
      const confirmResponse = await request(app)
        .post(`/api/payments/payment-intent/${paymentIntentId}/confirm`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          paymentMethodId: "pm_card_visa", // Test payment method
        });

      expect(confirmResponse.status).toBe(200);
      expect(confirmResponse.body.data.status).toBe("succeeded");

      // 4. Verify payment in database
      const paymentHistory = await request(app)
        .get("/api/payments/history")
        .set("Authorization", `Bearer ${authToken}`);

      expect(paymentHistory.status).toBe(200);
      expect(paymentHistory.body.data).toHaveLength(1);
      expect(paymentHistory.body.data[0].status).toBe("succeeded");
    });

    it("should handle payment failure gracefully", async () => {
      // Create payment intent with declined card
      const paymentIntentResponse = await request(app)
        .post("/api/payments/payment-intent")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          amount: 2000,
          currency: "usd",
          customerId,
        });

      const paymentIntentId = paymentIntentResponse.body.data.id;

      // Confirm payment with declined card
      const confirmResponse = await request(app)
        .post(`/api/payments/payment-intent/${paymentIntentId}/confirm`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          paymentMethodId: "pm_card_chargeDeclined",
        });

      expect(confirmResponse.status).toBe(400);
      expect(confirmResponse.body.success).toBe(false);
      expect(confirmResponse.body.error.code).toBe("CARD_DECLINED");
    });
  });
});
```

### Subscription Flow Integration Test

```typescript
// tests/integration/subscription-flow.test.ts
describe("Subscription Flow Integration", () => {
  let authToken: string;
  let customerId: string;
  let priceId: string;

  beforeAll(async () => {
    authToken = await setupTestUser();
    customerId = await createTestCustomer();
    priceId = await createTestPrice();
  });

  describe("Complete subscription flow", () => {
    it("should create and manage subscription lifecycle", async () => {
      // 1. Create subscription
      const subscriptionResponse = await request(app)
        .post("/api/subscriptions")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          customerId,
          priceId,
          trialPeriodDays: 14,
        });

      expect(subscriptionResponse.status).toBe(200);
      expect(subscriptionResponse.body.data.status).toBe("trialing");
      const subscriptionId = subscriptionResponse.body.data.id;

      // 2. Update subscription
      const updateResponse = await request(app)
        .put(`/api/subscriptions/${subscriptionId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          quantity: 2,
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.quantity).toBe(2);

      // 3. Get upcoming invoice
      const invoiceResponse = await request(app)
        .get(`/api/subscriptions/${subscriptionId}/upcoming-invoice`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(invoiceResponse.status).toBe(200);
      expect(invoiceResponse.body.data.amount_due).toBeGreaterThan(0);

      // 4. Cancel subscription
      const cancelResponse = await request(app)
        .delete(`/api/subscriptions/${subscriptionId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          cancelAtPeriodEnd: true,
        });

      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.data.cancel_at_period_end).toBe(true);
    });
  });
});
```

## Webhook Testing

### Webhook Integration Test

```typescript
// tests/integration/webhook.test.ts
import request from "supertest";
import Stripe from "stripe";
import { app } from "../../src/app";
import { testConfig } from "../../src/config/test";

describe("Webhook Integration", () => {
  let stripe: Stripe;

  beforeAll(() => {
    stripe = new Stripe(testConfig.stripe.secretKey, {
      apiVersion: testConfig.stripe.apiVersion,
    });
  });

  describe("Payment Intent Webhooks", () => {
    it("should process payment_intent.succeeded webhook", async () => {
      const mockEvent = {
        id: "evt_test_webhook",
        object: "event",
        api_version: "2023-10-16",
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: "pi_1234567890",
            object: "payment_intent",
            amount: 2000,
            currency: "usd",
            status: "succeeded",
            customer: "cus_1234567890",
          },
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: "req_1234567890",
          idempotency_key: null,
        },
        type: "payment_intent.succeeded",
      };

      const payload = JSON.stringify(mockEvent);
      const signature = stripe.webhooks.generateTestHeaderString({
        payload,
        secret: testConfig.stripe.webhookSecret,
      });

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.text).toBe("Webhook processed successfully");

      // Verify database was updated
      // Add assertions based on your database implementation
    });

    it("should reject invalid webhook signature", async () => {
      const mockEvent = {
        id: "evt_test_webhook",
        type: "payment_intent.succeeded",
        data: { object: {} },
      };

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", "invalid_signature")
        .send(JSON.stringify(mockEvent));

      expect(response.status).toBe(400);
      expect(response.text).toBe("Webhook processing failed");
    });
  });

  describe("Subscription Webhooks", () => {
    it("should process customer.subscription.created webhook", async () => {
      const mockEvent = {
        id: "evt_test_webhook",
        type: "customer.subscription.created",
        data: {
          object: {
            id: "sub_1234567890",
            object: "subscription",
            customer: "cus_1234567890",
            status: "active",
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 2592000, // 30 days
          },
        },
      };

      const payload = JSON.stringify(mockEvent);
      const signature = stripe.webhooks.generateTestHeaderString({
        payload,
        secret: testConfig.stripe.webhookSecret,
      });

      const response = await request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", signature)
        .send(payload);

      expect(response.status).toBe(200);
    });
  });
});
```

### Local Webhook Testing with Stripe CLI

```bash
#!/bin/bash
# scripts/test-webhooks.sh

# Start the local server
npm run dev &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Start Stripe CLI webhook forwarding
stripe listen --forward-to localhost:3000/api/webhooks/stripe &
STRIPE_PID=$!

# Wait for webhook setup
sleep 3

# Trigger test events
echo "Testing payment_intent.succeeded..."
stripe trigger payment_intent.succeeded

echo "Testing customer.subscription.created..."
stripe trigger customer.subscription.created

echo "Testing invoice.payment_failed..."
stripe trigger invoice.payment_failed

# Wait for events to process
sleep 5

# Cleanup
kill $SERVER_PID
kill $STRIPE_PID

echo "Webhook testing completed"
```

## End-to-End Testing

### E2E Test Setup

```typescript
// tests/e2e/setup.ts
import { chromium, Browser, Page } from "playwright";
import { app } from "../../src/app";

export class E2ETestSetup {
  private browser: Browser;
  private page: Page;
  private server: any;

  async setup() {
    // Start test server
    this.server = app.listen(3001);

    // Start browser
    this.browser = await chromium.launch();
    this.page = await this.browser.newPage();

    return { page: this.page, server: this.server };
  }

  async teardown() {
    await this.browser?.close();
    await this.server?.close();
  }
}
```

### Payment E2E Test

```typescript
// tests/e2e/payment.e2e.test.ts
import { test, expect } from "@playwright/test";

test.describe("Payment Flow E2E", () => {
  test("should complete payment flow through UI", async ({ page }) => {
    // Navigate to payment page
    await page.goto("http://localhost:3001/payment");

    // Fill payment form
    await page.fill('[data-testid="amount"]', "20.00");
    await page.fill('[data-testid="email"]', "test@example.com");

    // Fill Stripe Elements (requires special handling)
    const stripeFrame = page.frameLocator(
      'iframe[name^="__privateStripeFrame"]',
    );
    await stripeFrame.fill('[name="cardnumber"]', "4242424242424242");
    await stripeFrame.fill('[name="exp-date"]', "1225");
    await stripeFrame.fill('[name="cvc"]', "123");

    // Submit payment
    await page.click('[data-testid="submit-payment"]');

    // Wait for success message
    await expect(page.locator('[data-testid="payment-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-id"]')).toContainText(
      "pi_",
    );
  });

  test("should handle payment failure", async ({ page }) => {
    await page.goto("http://localhost:3001/payment");

    // Fill with declined card
    await page.fill('[data-testid="amount"]', "20.00");
    await page.fill('[data-testid="email"]', "test@example.com");

    const stripeFrame = page.frameLocator(
      'iframe[name^="__privateStripeFrame"]',
    );
    await stripeFrame.fill('[name="cardnumber"]', "4000000000000002"); // Declined card
    await stripeFrame.fill('[name="exp-date"]', "1225");
    await stripeFrame.fill('[name="cvc"]', "123");

    await page.click('[data-testid="submit-payment"]');

    // Wait for error message
    await expect(page.locator('[data-testid="payment-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-error"]')).toContainText(
      "declined",
    );
  });
});
```

## Performance Testing

### Load Testing with Artillery

```yaml
# tests/performance/load-test.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
  variables:
    authToken: "Bearer test_jwt_token"

scenarios:
  - name: "Payment Creation Load Test"
    weight: 70
    flow:
      - post:
          url: "/api/payments/payment-intent"
          headers:
            Authorization: "{{ authToken }}"
          json:
            amount: 2000
            currency: "usd"
            customerId: "cus_test_1234567890"

  - name: "Customer Creation Load Test"
    weight: 20
    flow:
      - post:
          url: "/api/customers"
          headers:
            Authorization: "{{ authToken }}"
          json:
            email: "test{{ $randomNumber() }}@example.com"
            name: "Test Customer {{ $randomNumber() }}"

  - name: "Webhook Processing Load Test"
    weight: 10
    flow:
      - post:
          url: "/api/webhooks/stripe"
          headers:
            stripe-signature: "test_signature"
          json:
            id: "evt_{{ $randomString() }}"
            type: "payment_intent.succeeded"
            data:
              object:
                id: "pi_{{ $randomString() }}"
                status: "succeeded"
```

### Performance Test Script

```bash
#!/bin/bash
# scripts/performance-test.sh

echo "Starting performance tests..."

# Install Artillery if not present
npm install -g artillery

# Run load tests
artillery run tests/performance/load-test.yml

# Run specific endpoint stress test
artillery quick --duration 60 --rate 50 http://localhost:3000/api/payments/payment-intent

echo "Performance tests completed"
```

## Test Utilities

### Test Helper Functions

```typescript
// tests/utils/test-helpers.ts
import Stripe from "stripe";
import { testConfig } from "../../src/config/test";

export class TestHelpers {
  private static stripe = new Stripe(testConfig.stripe.secretKey, {
    apiVersion: testConfig.stripe.apiVersion,
  });

  static async createTestCustomer(email = "test@example.com") {
    return await this.stripe.customers.create({
      email,
      name: "Test Customer",
      metadata: { test: "true" },
    });
  }

  static async createTestPaymentMethod(customerId: string) {
    const paymentMethod = await this.stripe.paymentMethods.create({
      type: "card",
      card: {
        number: "4242424242424242",
        exp_month: 12,
        exp_year: 2025,
        cvc: "123",
      },
    });

    await this.stripe.paymentMethods.attach(paymentMethod.id, {
      customer: customerId,
    });

    return paymentMethod;
  }

  static async createTestProduct() {
    return await this.stripe.products.create({
      name: "Test Product",
      metadata: { test: "true" },
    });
  }

  static async createTestPrice(productId: string) {
    return await this.stripe.prices.create({
      product: productId,
      unit_amount: 2000,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { test: "true" },
    });
  }

  static async cleanupTestData() {
    // Clean up test customers
    const customers = await this.stripe.customers.list({
      limit: 100,
    });

    for (const customer of customers.data) {
      if (customer.metadata?.test === "true") {
        await this.stripe.customers.del(customer.id);
      }
    }

    // Clean up test products
    const products = await this.stripe.products.list({
      limit: 100,
    });

    for (const product of products.data) {
      if (product.metadata?.test === "true") {
        await this.stripe.products.update(product.id, { active: false });
      }
    }
  }

  static generateWebhookSignature(payload: string, secret: string) {
    return this.stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    });
  }
}
```

### Database Test Utilities

```typescript
// tests/utils/db-helpers.ts
import { Pool } from "pg";
import { testConfig } from "../../src/config/test";

export class DatabaseTestHelpers {
  private static pool = new Pool({
    connectionString: testConfig.database.url,
  });

  static async clearTestData() {
    await this.pool.query(
      "DELETE FROM webhook_events WHERE created_at < NOW()",
    );
    await this.pool.query("DELETE FROM subscriptions WHERE created_at < NOW()");
    await this.pool.query("DELETE FROM payments WHERE created_at < NOW()");
    await this.pool.query("DELETE FROM users WHERE email LIKE %test%");
  }

  static async seedTestData() {
    // Insert test users, payments, subscriptions as needed
    const testUser = await this.pool.query(`
      INSERT INTO users (email, name, stripe_customer_id)
      VALUES ('test@example.com', 'Test User', 'cus_test_1234567890')
      RETURNING id
    `);

    return testUser.rows[0];
  }

  static async getPaymentByStripeId(stripePaymentIntentId: string) {
    const result = await this.pool.query(
      "SELECT * FROM payments WHERE stripe_payment_intent_id = $1",
      [stripePaymentIntentId],
    );
    return result.rows[0];
  }

  static async getSubscriptionByStripeId(stripeSubscriptionId: string) {
    const result = await this.pool.query(
      "SELECT * FROM subscriptions WHERE stripe_subscription_id = $1",
      [stripeSubscriptionId],
    );
    return result.rows[0];
  }
}
```

## Test Scripts

### Package.json Test Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:integration": "jest --config jest.integration.config.js",
    "test:e2e": "playwright test",
    "test:performance": "./scripts/performance-test.sh",
    "test:webhooks": "./scripts/test-webhooks.sh",
    "test:all": "npm run test && npm run test:integration && npm run test:e2e"
  }
}
```

### CI/CD Test Pipeline

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
          cache: "npm"
      - run: npm ci
      - run: npm run test:coverage
        env:
          STRIPE_PUBLISHABLE_KEY: ${{ secrets.STRIPE_TEST_PUBLISHABLE_KEY }}
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
          STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_TEST_WEBHOOK_SECRET }}

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
          cache: "npm"
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test_db
          STRIPE_PUBLISHABLE_KEY: ${{ secrets.STRIPE_TEST_PUBLISHABLE_KEY }}
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
          STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_TEST_WEBHOOK_SECRET }}

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
          cache: "npm"
      - run: npm ci
      - run: npx playwright install
      - run: npm run test:e2e
        env:
          STRIPE_PUBLISHABLE_KEY: ${{ secrets.STRIPE_TEST_PUBLISHABLE_KEY }}
```

## Related Documentation

- [Stripe Integration Guide](./stripe-integration.md)
- [Stripe API Reference](./stripe-api-reference.md)
- [Stripe Webhook Guide](./stripe-webhook-guide.md)
- [Stripe Configuration Guide](./stripe-configuration-guide.md)
