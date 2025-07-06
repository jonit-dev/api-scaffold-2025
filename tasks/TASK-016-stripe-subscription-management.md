# TASK-016: Stripe Subscription Management

## Overview

Implement comprehensive subscription management functionality using Stripe Subscriptions API, including subscription creation, updates, cancellations, and billing cycle management.

## Epic

**Payment Processing Infrastructure**

## Priority

High

## Story Points

12

## Description

Create a full-featured subscription management system that handles subscription lifecycles, billing periods, plan changes, proration, and subscription status tracking. This includes integration with existing customer management and webhook systems.

## Acceptance Criteria

### 1. Subscription Service Implementation

- [ ] Create `src/services/stripe-subscription.service.ts` with full subscription CRUD operations
- [ ] Implement subscription creation with various billing intervals
- [ ] Add subscription update and plan change functionality
- [ ] Implement subscription cancellation (immediate and at period end)
- [ ] Add subscription pause and resume functionality

### 2. Product and Price Management

- [ ] Create product and price management service
- [ ] Implement price creation and updates
- [ ] Add support for different billing intervals (monthly, yearly, etc.)
- [ ] Handle tiered pricing and usage-based billing
- [ ] Implement price archiving and activation

### 3. Subscription Lifecycle Management

- [ ] Handle subscription trial periods
- [ ] Implement subscription renewals
- [ ] Add proration calculations for plan changes
- [ ] Handle subscription failures and retry logic
- [ ] Implement subscription downgrade/upgrade flows

### 4. Database Integration

- [ ] Create subscription entity and repository
- [ ] Add subscription-user relationship management
- [ ] Implement subscription history tracking
- [ ] Create subscription metrics and reporting
- [ ] Add subscription billing history

### 5. Webhook Integration

- [ ] Handle subscription webhook events
- [ ] Process subscription status changes
- [ ] Handle failed payment events
- [ ] Implement subscription renewal notifications
- [ ] Add subscription cancellation handling

## Technical Requirements

### Subscription Service Methods

```typescript
@Service()
export class StripeSubscriptionService {
  // Subscription lifecycle
  async createSubscription(
    data: ICreateSubscriptionDto,
  ): Promise<Stripe.Subscription>;
  async updateSubscription(
    subscriptionId: string,
    data: IUpdateSubscriptionDto,
  ): Promise<Stripe.Subscription>;
  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd?: boolean,
  ): Promise<Stripe.Subscription>;
  async pauseSubscription(subscriptionId: string): Promise<Stripe.Subscription>;
  async resumeSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription>;

  // Plan management
  async changeSubscriptionPlan(
    subscriptionId: string,
    newPriceId: string,
  ): Promise<Stripe.Subscription>;
  async addSubscriptionItem(
    subscriptionId: string,
    priceId: string,
    quantity?: number,
  ): Promise<Stripe.Subscription>;
  async removeSubscriptionItem(
    subscriptionId: string,
    itemId: string,
  ): Promise<Stripe.Subscription>;

  // Billing and invoicing
  async previewUpcomingInvoice(subscriptionId: string): Promise<Stripe.Invoice>;
  async createProrationPreview(
    subscriptionId: string,
    newPriceId: string,
  ): Promise<Stripe.Invoice>;
  async updateSubscriptionQuantity(
    subscriptionId: string,
    quantity: number,
  ): Promise<Stripe.Subscription>;

  // Utility methods
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription>;
  async listCustomerSubscriptions(
    customerId: string,
  ): Promise<Stripe.Subscription[]>;
  async getSubscriptionUsage(
    subscriptionId: string,
  ): Promise<Stripe.UsageRecord[]>;
}
```

### Product and Price Service

```typescript
@Service()
export class StripeProductService {
  // Product management
  async createProduct(data: ICreateProductDto): Promise<Stripe.Product>;
  async updateProduct(
    productId: string,
    data: IUpdateProductDto,
  ): Promise<Stripe.Product>;
  async archiveProduct(productId: string): Promise<Stripe.Product>;

  // Price management
  async createPrice(data: ICreatePriceDto): Promise<Stripe.Price>;
  async updatePrice(
    priceId: string,
    data: IUpdatePriceDto,
  ): Promise<Stripe.Price>;
  async archivePrice(priceId: string): Promise<Stripe.Price>;

  // Utility methods
  async listProducts(): Promise<Stripe.Product[]>;
  async listPrices(productId?: string): Promise<Stripe.Price[]>;
}
```

### Subscription Entity

```typescript
export interface ISubscription {
  id: string;
  stripeSubscriptionId: string;
  userId: string;
  customerId: string;
  productId: string;
  priceId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  quantity: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export enum SubscriptionStatus {
  ACTIVE = "active",
  PAST_DUE = "past_due",
  UNPAID = "unpaid",
  CANCELED = "canceled",
  INCOMPLETE = "incomplete",
  INCOMPLETE_EXPIRED = "incomplete_expired",
  TRIALING = "trialing",
  PAUSED = "paused",
}
```

### Subscription DTOs

```typescript
export interface ICreateSubscriptionDto {
  customerId: string;
  priceId: string;
  quantity?: number;
  trialPeriodDays?: number;
  paymentMethodId?: string;
  prorationBehavior?: "create_prorations" | "none" | "always_invoice";
  metadata?: Record<string, string>;
}

export interface IUpdateSubscriptionDto {
  priceId?: string;
  quantity?: number;
  prorationBehavior?: "create_prorations" | "none" | "always_invoice";
  metadata?: Record<string, string>;
}

export interface ICreateProductDto {
  name: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface ICreatePriceDto {
  productId: string;
  unitAmount: number;
  currency: string;
  recurring: {
    interval: "month" | "year" | "week" | "day";
    intervalCount?: number;
  };
  metadata?: Record<string, string>;
}
```

## Implementation Notes

1. **Trial Management**: Implement proper trial period handling and notifications
2. **Proration**: Handle proration calculations for plan changes and upgrades
3. **Billing Cycles**: Support different billing intervals and custom billing cycles
4. **Failed Payments**: Implement retry logic and dunning management
5. **Subscription Analytics**: Track subscription metrics and churn rates
6. **Compliance**: Ensure proper handling of subscription cancellations and refunds

## Testing Requirements

### Unit Tests

- [ ] Test subscription creation with various configurations
- [ ] Test subscription updates and plan changes
- [ ] Test subscription cancellation scenarios
- [ ] Test proration calculations
- [ ] Test subscription webhook event handling
- [ ] Test subscription status transitions
- [ ] Test product and price management

### Integration Tests

- [ ] Test complete subscription lifecycle with Stripe API
- [ ] Test subscription plan changes with proration
- [ ] Test subscription failure and retry scenarios
- [ ] Test subscription webhook processing
- [ ] Test subscription billing and invoicing
- [ ] Test subscription metrics and reporting

## Definition of Done

- [ ] All acceptance criteria completed
- [ ] Unit tests written and passing (>80% coverage)
- [ ] Integration tests passing
- [ ] Code reviewed and approved
- [ ] Database migrations created and tested
- [ ] Documentation updated
- [ ] Webhook integration implemented
- [ ] Subscription analytics implemented
- [ ] Error handling and logging added

## Dependencies

- **Requires**: TASK-012 (Stripe Setup), TASK-013 (Customer Management), TASK-015 (Webhook Handling)
- **Blocks**: TASK-017 (Controller Implementation)

## Estimated Duration

5-6 days

## Risk Assessment

**High Risk**

- Complex subscription lifecycle management
- Proration calculation complexity
- Billing cycle edge cases
- Webhook event handling complexity

## Database Changes

### Subscription Table

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  stripe_customer_id VARCHAR(255) NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  price_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  quantity INTEGER DEFAULT 1,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_current_period_end ON subscriptions(current_period_end);
```

### Subscription History Table

```sql
CREATE TABLE subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  action VARCHAR(50) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscription_history_subscription_id ON subscription_history(subscription_id);
```

## Webhook Events

### Subscription-Related Events

```typescript
export enum SubscriptionWebhookEvent {
  SUBSCRIPTION_CREATED = "customer.subscription.created",
  SUBSCRIPTION_UPDATED = "customer.subscription.updated",
  SUBSCRIPTION_DELETED = "customer.subscription.deleted",
  SUBSCRIPTION_TRIAL_WILL_END = "customer.subscription.trial_will_end",
  INVOICE_UPCOMING = "invoice.upcoming",
  INVOICE_PAYMENT_SUCCEEDED = "invoice.payment_succeeded",
  INVOICE_PAYMENT_FAILED = "invoice.payment_failed",
}
```

## Configuration Integration

```typescript
// Add to src/config/env.ts
export const config = {
  // ... existing config
  subscription: {
    defaultTrialDays: parseInt(process.env.DEFAULT_TRIAL_DAYS || "14", 10),
    allowMultipleSubscriptions:
      process.env.ALLOW_MULTIPLE_SUBSCRIPTIONS === "true",
    prorationBehavior: process.env.PRORATION_BEHAVIOR || "create_prorations",
    gracePeriodDays: parseInt(process.env.GRACE_PERIOD_DAYS || "3", 10),
    maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || "3", 10),
  },
};
```

## Security Considerations

- [ ] Validate subscription ownership before operations
- [ ] Implement proper access controls for subscription management
- [ ] Add audit logging for subscription changes
- [ ] Validate price and product IDs before creating subscriptions
- [ ] Implement proper error handling for subscription operations
- [ ] Add rate limiting for subscription endpoints

## Subscription Analytics

- [ ] Track subscription creation rates
- [ ] Monitor subscription churn rates
- [ ] Calculate Monthly Recurring Revenue (MRR)
- [ ] Track subscription lifecycle metrics
- [ ] Monitor failed payment rates
- [ ] Implement subscription cohort analysis

## Notes

- Implement proper subscription downgrade/upgrade flows
- Consider implementing subscription add-ons and usage-based billing
- Plan for subscription export functionality for compliance
- Implement proper subscription notification system
- Consider implementing subscription gifting functionality
- Plan for subscription analytics and reporting dashboard
