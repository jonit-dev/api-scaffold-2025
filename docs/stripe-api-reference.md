# Stripe API Reference

## Overview

This document provides detailed API reference for all Stripe-related endpoints in the API scaffold, including request/response formats, authentication requirements, and usage examples.

## Base URL

```
Production: https://api.yourdomain.com
Development: http://localhost:3000
```

## Authentication

All API endpoints require JWT authentication unless specified otherwise.

```http
Authorization: Bearer <jwt_token>
```

## Common Response Format

```typescript
interface IApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}
```

## Payment Endpoints

### Create Payment Intent

Creates a new payment intent for processing payments.

```http
POST /api/payments/payment-intent
```

**Request Body:**

```typescript
{
  amount: number;           // Amount in cents (e.g., 2000 = $20.00)
  currency: string;         // Currency code (e.g., "usd", "eur")
  customerId?: string;      // Stripe customer ID
  paymentMethodId?: string; // Payment method ID
  captureMethod?: 'automatic' | 'manual';
  description?: string;     // Payment description
  metadata?: Record<string, string>;
}
```

**Response:**

```typescript
{
  success: true,
  data: {
    id: "pi_1234567890",
    amount: 2000,
    currency: "usd",
    status: "requires_payment_method",
    client_secret: "pi_1234567890_secret_abc123",
    created: 1234567890,
    // ... other Stripe PaymentIntent fields
  }
}
```

**Example:**

```javascript
// Create payment intent
const response = await fetch("/api/payments/payment-intent", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    amount: 2000,
    currency: "usd",
    description: "Product purchase",
  }),
});
```

### Confirm Payment Intent

Confirms a payment intent with a payment method.

```http
POST /api/payments/payment-intent/:id/confirm
```

**Request Body:**

```typescript
{
  paymentMethodId?: string; // Payment method ID
  returnUrl?: string;       // URL to redirect after payment
}
```

**Response:**

```typescript
{
  success: true,
  data: {
    id: "pi_1234567890",
    status: "succeeded",
    amount: 2000,
    currency: "usd",
    // ... other PaymentIntent fields
  }
}
```

### Capture Payment Intent

Captures a payment intent that was created with manual capture.

```http
POST /api/payments/payment-intent/:id/capture
```

**Request Body:**

```typescript
{
  amountToCapture?: number; // Amount to capture (optional, defaults to full amount)
}
```

### Refund Payment

Creates a refund for a successful payment.

```http
POST /api/payments/payment-intent/:id/refund
```

**Request Body:**

```typescript
{
  amount?: number;          // Amount to refund (optional, defaults to full amount)
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, string>;
}
```

**Response:**

```typescript
{
  success: true,
  data: {
    id: "re_1234567890",
    amount: 2000,
    currency: "usd",
    status: "succeeded",
    payment_intent: "pi_1234567890",
    // ... other Stripe Refund fields
  }
}
```

### Get Payment Intent

Retrieves details of a specific payment intent.

```http
GET /api/payments/payment-intent/:id
```

**Response:**

```typescript
{
  success: true,
  data: {
    id: "pi_1234567890",
    amount: 2000,
    currency: "usd",
    status: "succeeded",
    // ... other PaymentIntent fields
  }
}
```

### Get Payment History

Retrieves payment history for the authenticated user.

```http
GET /api/payments/history
```

**Query Parameters:**

```typescript
{
  limit?: number;     // Number of results (default: 10, max: 100)
  offset?: number;    // Number of results to skip
  status?: string;    // Filter by payment status
  from?: string;      // Start date (ISO string)
  to?: string;        // End date (ISO string)
}
```

**Response:**

```typescript
{
  success: true,
  data: [
    {
      id: "payment_1",
      stripePaymentIntentId: "pi_1234567890",
      amount: 2000,
      currency: "usd",
      status: "succeeded",
      createdAt: "2023-01-01T00:00:00Z",
      // ... other payment fields
    }
  ],
  meta: {
    total: 50,
    page: 1,
    limit: 10
  }
}
```

## Customer Endpoints

### Create Customer

Creates a new Stripe customer.

```http
POST /api/customers
```

**Request Body:**

```typescript
{
  email: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, string>;
}
```

**Response:**

```typescript
{
  success: true,
  data: {
    id: "cus_1234567890",
    email: "customer@example.com",
    name: "John Doe",
    created: 1234567890,
    // ... other Stripe Customer fields
  }
}
```

### Get Customer

Retrieves customer details.

```http
GET /api/customers/:id
```

**Response:**

```typescript
{
  success: true,
  data: {
    id: "cus_1234567890",
    email: "customer@example.com",
    name: "John Doe",
    // ... other Customer fields
  }
}
```

### Update Customer

Updates customer information.

```http
PUT /api/customers/:id
```

**Request Body:**

```typescript
{
  name?: string;
  email?: string;
  phone?: string;
  metadata?: Record<string, string>;
}
```

### Delete Customer

Deletes a customer.

```http
DELETE /api/customers/:id
```

**Response:**

```typescript
{
  success: true,
  data: {
    deleted: true,
    id: "cus_1234567890"
  }
}
```

### Get Customer Payment Methods

Retrieves payment methods for a customer.

```http
GET /api/customers/:id/payment-methods
```

**Response:**

```typescript
{
  success: true,
  data: [
    {
      id: "pm_1234567890",
      type: "card",
      card: {
        brand: "visa",
        last4: "4242",
        exp_month: 12,
        exp_year: 2025
      },
      // ... other PaymentMethod fields
    }
  ]
}
```

### Attach Payment Method

Attaches a payment method to a customer.

```http
POST /api/customers/:id/payment-methods
```

**Request Body:**

```typescript
{
  paymentMethodId: string;
}
```

## Subscription Endpoints

### Create Subscription

Creates a new subscription for a customer.

```http
POST /api/subscriptions
```

**Request Body:**

```typescript
{
  customerId: string;
  priceId: string;
  quantity?: number;
  trialPeriodDays?: number;
  paymentMethodId?: string;
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
  metadata?: Record<string, string>;
}
```

**Response:**

```typescript
{
  success: true,
  data: {
    id: "sub_1234567890",
    customer: "cus_1234567890",
    status: "active",
    current_period_start: 1234567890,
    current_period_end: 1234567890,
    // ... other Subscription fields
  }
}
```

### List Subscriptions

Lists subscriptions for the authenticated user.

```http
GET /api/subscriptions
```

**Query Parameters:**

```typescript
{
  status?: string;    // Filter by subscription status
  limit?: number;     // Number of results
  offset?: number;    // Number of results to skip
}
```

### Update Subscription

Updates a subscription.

```http
PUT /api/subscriptions/:id
```

**Request Body:**

```typescript
{
  priceId?: string;
  quantity?: number;
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
  metadata?: Record<string, string>;
}
```

### Cancel Subscription

Cancels a subscription.

```http
DELETE /api/subscriptions/:id
```

**Request Body:**

```typescript
{
  cancelAtPeriodEnd?: boolean; // Default: true
}
```

### Pause Subscription

Pauses a subscription.

```http
POST /api/subscriptions/:id/pause
```

**Response:**

```typescript
{
  success: true,
  data: {
    id: "sub_1234567890",
    status: "paused",
    pause_collection: {
      behavior: "keep_as_draft"
    },
    // ... other Subscription fields
  }
}
```

### Resume Subscription

Resumes a paused subscription.

```http
POST /api/subscriptions/:id/resume
```

### Get Upcoming Invoice

Retrieves the upcoming invoice for a subscription.

```http
GET /api/subscriptions/:id/upcoming-invoice
```

**Response:**

```typescript
{
  success: true,
  data: {
    id: "in_1234567890",
    amount_due: 2000,
    currency: "usd",
    period_start: 1234567890,
    period_end: 1234567890,
    // ... other Invoice fields
  }
}
```

## Product Endpoints

### List Products

Lists all available products.

```http
GET /api/products
```

**Response:**

```typescript
{
  success: true,
  data: [
    {
      id: "prod_1234567890",
      name: "Basic Plan",
      description: "Basic subscription plan",
      active: true,
      // ... other Product fields
    }
  ]
}
```

### Get Product

Retrieves a specific product.

```http
GET /api/products/:id
```

### Get Product Prices

Retrieves prices for a specific product.

```http
GET /api/products/:id/prices
```

**Response:**

```typescript
{
  success: true,
  data: [
    {
      id: "price_1234567890",
      product: "prod_1234567890",
      unit_amount: 2000,
      currency: "usd",
      recurring: {
        interval: "month",
        interval_count: 1
      },
      // ... other Price fields
    }
  ]
}
```

### Create Product (Admin Only)

Creates a new product.

```http
POST /api/products
```

**Headers:**

```http
Authorization: Bearer <admin_jwt_token>
```

**Request Body:**

```typescript
{
  name: string;
  description?: string;
  metadata?: Record<string, string>;
}
```

## Webhook Endpoints

### Process Stripe Webhook

Processes incoming Stripe webhooks.

```http
POST /api/webhooks/stripe
```

**Headers:**

```http
Stripe-Signature: <stripe_signature>
Content-Type: application/json
```

**Note:** This endpoint does not require JWT authentication but requires valid Stripe webhook signature.

## Error Codes

### Payment Errors

| Code                 | Message                | Description                            |
| -------------------- | ---------------------- | -------------------------------------- |
| `CARD_DECLINED`      | Your card was declined | Card was declined by issuer            |
| `INSUFFICIENT_FUNDS` | Insufficient funds     | Card has insufficient funds            |
| `INVALID_CARD`       | Invalid card details   | Card number, expiry, or CVC is invalid |
| `PAYMENT_FAILED`     | Payment failed         | Generic payment failure                |
| `AMOUNT_TOO_LARGE`   | Amount exceeds limit   | Payment amount exceeds maximum         |
| `AMOUNT_TOO_SMALL`   | Amount below minimum   | Payment amount below minimum           |

### Customer Errors

| Code                 | Message                 | Description                        |
| -------------------- | ----------------------- | ---------------------------------- |
| `CUSTOMER_NOT_FOUND` | Customer not found      | Customer ID does not exist         |
| `INVALID_EMAIL`      | Invalid email address   | Email format is invalid            |
| `CUSTOMER_EXISTS`    | Customer already exists | Customer with email already exists |

### Subscription Errors

| Code                     | Message                   | Description                         |
| ------------------------ | ------------------------- | ----------------------------------- |
| `SUBSCRIPTION_NOT_FOUND` | Subscription not found    | Subscription ID does not exist      |
| `INVALID_PLAN`           | Invalid subscription plan | Plan ID is invalid or inactive      |
| `SUBSCRIPTION_CANCELED`  | Subscription is canceled  | Cannot modify canceled subscription |
| `TRIAL_EXPIRED`          | Trial period expired      | Trial has expired                   |

### General Errors

| Code              | Message               | Description                     |
| ----------------- | --------------------- | ------------------------------- |
| `UNAUTHORIZED`    | Unauthorized access   | Invalid or missing JWT token    |
| `FORBIDDEN`       | Access denied         | User lacks required permissions |
| `INVALID_REQUEST` | Invalid request       | Request validation failed       |
| `RATE_LIMITED`    | Too many requests     | Rate limit exceeded             |
| `INTERNAL_ERROR`  | Internal server error | Unexpected server error         |

## Rate Limits

| Endpoint Category      | Limit        | Window   |
| ---------------------- | ------------ | -------- |
| Payment endpoints      | 10 requests  | 1 minute |
| Customer endpoints     | 20 requests  | 1 minute |
| Subscription endpoints | 5 requests   | 1 minute |
| Product endpoints      | 30 requests  | 1 minute |
| Webhook endpoints      | 100 requests | 1 minute |

## SDKs and Examples

### JavaScript/TypeScript

```javascript
// Payment intent example
const createPaymentIntent = async (amount, currency) => {
  const response = await fetch("/api/payments/payment-intent", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency,
      description: "Product purchase",
    }),
  });

  const result = await response.json();
  return result.data;
};

// Subscription example
const createSubscription = async (customerId, priceId) => {
  const response = await fetch("/api/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customerId,
      priceId,
      trialPeriodDays: 14,
    }),
  });

  const result = await response.json();
  return result.data;
};
```

### cURL Examples

```bash
# Create payment intent
curl -X POST https://api.yourdomain.com/api/payments/payment-intent \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 2000,
    "currency": "usd",
    "description": "Product purchase"
  }'

# Create subscription
curl -X POST https://api.yourdomain.com/api/subscriptions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cus_1234567890",
    "priceId": "price_1234567890",
    "trialPeriodDays": 14
  }'
```

## Testing

### Test Cards

Use these test card numbers in development:

| Card Number      | Brand | Description        |
| ---------------- | ----- | ------------------ |
| 4242424242424242 | Visa  | Succeeds           |
| 4000000000000002 | Visa  | Declined           |
| 4000000000009995 | Visa  | Insufficient funds |
| 4000000000009987 | Visa  | Lost card          |
| 4000000000009979 | Visa  | Stolen card        |

### Test Customers

```javascript
// Create test customer
const testCustomer = {
  email: "test@example.com",
  name: "Test Customer",
  metadata: {
    test: "true",
  },
};
```

## Related Documentation

- [Stripe Integration Guide](./stripe-integration.md)
- [Stripe Webhook Guide](./stripe-webhook-guide.md)
- [Stripe Configuration Guide](./stripe-configuration-guide.md)
- [Stripe Testing Guide](./stripe-testing-guide.md)
