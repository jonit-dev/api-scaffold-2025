# TASK-014: Stripe Payment Processing Service

## Overview

Implement comprehensive payment processing functionality using Stripe Payment Intents, including payment creation, confirmation, capture, and refund operations.

## Epic

**Payment Processing Infrastructure**

## Priority

High

## Story Points

10

## Description

Create a robust payment processing service that handles the complete payment lifecycle using Stripe's Payment Intents API. This includes support for various payment methods, payment status tracking, and proper error handling for different payment scenarios.

## Acceptance Criteria

### 1. Payment Intent Service

- [ ] Create `src/services/stripe-payment.service.ts` with Payment Intent operations
- [ ] Implement payment intent creation with configurable options
- [ ] Add payment confirmation and capture functionality
- [ ] Implement payment cancellation and refund operations
- [ ] Add payment method attachment to customers

### 2. Payment Processing Methods

- [ ] Create payment intent with amount and currency
- [ ] Handle different payment methods (card, bank transfer, etc.)
- [ ] Implement payment confirmation flow
- [ ] Add manual payment capture functionality
- [ ] Create partial and full refund operations

### 3. Payment Status Management

- [ ] Track payment status throughout lifecycle
- [ ] Implement payment status webhooks handling
- [ ] Add payment failure handling and retry logic
- [ ] Create payment history tracking
- [ ] Implement payment reconciliation utilities

### 4. Payment DTOs and Validation

- [ ] Create `src/models/dtos/payment.dto.ts` for payment operations
- [ ] Add validation for payment amounts and currencies
- [ ] Implement payment method validation
- [ ] Create payment response DTOs
- [ ] Add payment metadata handling

### 5. Database Integration

- [ ] Create payment entity in database
- [ ] Add payment history tracking
- [ ] Implement payment-user relationship
- [ ] Create payment status updates
- [ ] Add payment audit logging

## Technical Requirements

### Payment Service Methods

```typescript
@Service()
export class StripePaymentService {
  // Payment Intent operations
  async createPaymentIntent(
    data: ICreatePaymentIntentDto,
  ): Promise<Stripe.PaymentIntent>;
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId?: string,
  ): Promise<Stripe.PaymentIntent>;
  async capturePaymentIntent(
    paymentIntentId: string,
    amountToCapture?: number,
  ): Promise<Stripe.PaymentIntent>;
  async cancelPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent>;

  // Refund operations
  async createRefund(
    paymentIntentId: string,
    amount?: number,
  ): Promise<Stripe.Refund>;
  async getRefund(refundId: string): Promise<Stripe.Refund>;

  // Payment method operations
  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string,
  ): Promise<Stripe.PaymentMethod>;
  async detachPaymentMethod(
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod>;

  // Utility methods
  async getPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent>;
  async listPaymentIntents(customerId: string): Promise<Stripe.PaymentIntent[]>;
}
```

### Payment Entity

```typescript
export interface IPayment {
  id: string;
  stripePaymentIntentId: string;
  userId: string;
  customerId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### Payment DTOs

```typescript
export interface ICreatePaymentIntentDto {
  amount: number;
  currency: string;
  customerId: string;
  paymentMethodId?: string;
  captureMethod?: "automatic" | "manual";
  description?: string;
  metadata?: Record<string, string>;
}

export interface IConfirmPaymentDto {
  paymentIntentId: string;
  paymentMethodId?: string;
  returnUrl?: string;
}

export interface IRefundDto {
  paymentIntentId: string;
  amount?: number;
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
  metadata?: Record<string, string>;
}
```

## Implementation Notes

1. **Security**: Always validate payment amounts and prevent manipulation
2. **Idempotency**: Use idempotency keys for payment operations
3. **Error Handling**: Implement comprehensive error handling for all payment scenarios
4. **Logging**: Add detailed logging for payment operations and status changes
5. **Webhooks**: Prepare for webhook integration for payment status updates
6. **Currency Support**: Support multiple currencies with proper validation

## Testing Requirements

### Unit Tests

- [ ] Test payment intent creation with valid data
- [ ] Test payment confirmation flow
- [ ] Test payment capture operations
- [ ] Test refund functionality
- [ ] Test payment method operations
- [ ] Test error handling for invalid payments
- [ ] Test payment status transitions

### Integration Tests

- [ ] Test complete payment flow with Stripe API
- [ ] Test payment failure scenarios
- [ ] Test refund operations
- [ ] Test payment method attachment
- [ ] Test webhook payload handling
- [ ] Test payment reconciliation

## Definition of Done

- [ ] All acceptance criteria completed
- [ ] Unit tests written and passing (>80% coverage)
- [ ] Integration tests passing
- [ ] Code reviewed and approved
- [ ] Database migrations created and tested
- [ ] Documentation updated
- [ ] Error handling implemented
- [ ] Logging added
- [ ] Payment security measures implemented

## Dependencies

- **Requires**: TASK-012 (Stripe Setup), TASK-013 (Customer Management)
- **Blocks**: TASK-015 (Webhook Handling), TASK-017 (Controller Implementation)

## Estimated Duration

4-5 days

## Risk Assessment

**High Risk**

- Payment processing complexity
- Security requirements
- Error handling complexity
- Regulatory compliance requirements

## Database Changes

### Payment Table

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  stripe_customer_id VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(50) NOT NULL,
  payment_method VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_status ON payments(status);
```

## Security Considerations

- [ ] Validate all payment amounts on server-side
- [ ] Implement proper authentication for payment operations
- [ ] Use HTTPS for all payment-related communications
- [ ] Implement rate limiting for payment endpoints
- [ ] Add audit logging for all payment operations
- [ ] Validate payment method ownership
- [ ] Implement proper error messages that don't leak sensitive information

## Configuration Integration

```typescript
// Add to src/config/env.ts
export const config = {
  // ... existing config
  payment: {
    defaultCurrency: process.env.DEFAULT_CURRENCY || "usd",
    maxPaymentAmount: parseInt(process.env.MAX_PAYMENT_AMOUNT || "100000", 10), // $1000.00
    minPaymentAmount: parseInt(process.env.MIN_PAYMENT_AMOUNT || "50", 10), // $0.50
    autoCapture: process.env.AUTO_CAPTURE_PAYMENTS === "true",
  },
};
```

## Notes

- Use Stripe's latest API version for Payment Intents
- Implement proper webhook handling for payment status updates
- Consider implementing payment retry logic for failed payments
- Plan for PCI compliance requirements
- Implement proper currency conversion handling
- Consider implementing payment scheduling for future enhancement
