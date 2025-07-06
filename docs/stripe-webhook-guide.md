# Stripe Webhook Guide

## Overview

This guide explains how to set up, configure, and manage Stripe webhooks in the API scaffold. Webhooks are essential for handling asynchronous events from Stripe and keeping your application data synchronized.

## What Are Webhooks?

Webhooks are HTTP callbacks that Stripe sends to your application when events occur in your Stripe account. They allow you to:

- Update payment statuses in real-time
- Handle subscription changes
- Process failed payments
- Manage customer updates
- Track invoice events

## Webhook Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│      Stripe         │    │   Your Server       │    │     Database        │
│                     │    │                     │    │                     │
│  ┌───────────────┐  │    │  ┌───────────────┐  │    │  ┌───────────────┐  │
│  │ Event Occurs  │  │───►│  │ Webhook       │  │───►│  │ Update Records│  │
│  │               │  │    │  │ Endpoint      │  │    │  │               │  │
│  └───────────────┘  │    │  └───────────────┘  │    │  └───────────────┘  │
│         │           │    │         │           │    │                     │
│  ┌───────────────┐  │    │  ┌───────────────┐  │    │  ┌───────────────┐  │
│  │ Send Webhook  │  │───►│  │ Verify        │  │───►│  │ Log Event     │  │
│  │               │  │    │  │ Signature     │  │    │  │               │  │
│  └───────────────┘  │    │  └───────────────┘  │    │  └───────────────┘  │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

## Webhook Events

### Payment Events

| Event                            | Description                                | Action                                   |
| -------------------------------- | ------------------------------------------ | ---------------------------------------- |
| `payment_intent.succeeded`       | Payment completed successfully             | Update payment status, send confirmation |
| `payment_intent.payment_failed`  | Payment failed                             | Update payment status, notify customer   |
| `payment_intent.canceled`        | Payment was canceled                       | Update payment status, handle cleanup    |
| `payment_intent.requires_action` | Payment requires additional authentication | Notify customer of required action       |

### Customer Events

| Event                     | Description                  | Action                       |
| ------------------------- | ---------------------------- | ---------------------------- |
| `customer.created`        | New customer created         | Sync customer data           |
| `customer.updated`        | Customer information updated | Update local customer record |
| `customer.deleted`        | Customer deleted             | Handle customer deletion     |
| `customer.source.created` | Payment method added         | Update payment methods       |
| `customer.source.deleted` | Payment method removed       | Remove payment method        |

### Subscription Events

| Event                                  | Description                    | Action                       |
| -------------------------------------- | ------------------------------ | ---------------------------- |
| `customer.subscription.created`        | New subscription created       | Create subscription record   |
| `customer.subscription.updated`        | Subscription updated           | Update subscription status   |
| `customer.subscription.deleted`        | Subscription canceled          | Handle cancellation          |
| `customer.subscription.trial_will_end` | Trial ending soon              | Send trial expiration notice |
| `invoice.payment_succeeded`            | Subscription payment succeeded | Update billing status        |
| `invoice.payment_failed`               | Subscription payment failed    | Handle payment failure       |

### Invoice Events

| Event                    | Description            | Action                 |
| ------------------------ | ---------------------- | ---------------------- |
| `invoice.created`        | Invoice created        | Log invoice creation   |
| `invoice.finalized`      | Invoice finalized      | Prepare for payment    |
| `invoice.paid`           | Invoice paid           | Update payment status  |
| `invoice.payment_failed` | Invoice payment failed | Handle payment failure |
| `invoice.upcoming`       | Invoice due soon       | Send payment reminder  |

## Webhook Setup

### 1. Configure Webhook Endpoint

```typescript
// src/controllers/webhook.controller.ts
import { Controller, Post, Req, Res, Body } from "routing-controllers";
import { Request, Response } from "express";
import { Container } from "typedi";
import { StripeWebhookService } from "../services/stripe-webhook.service";

@Controller("/api/webhooks")
export class WebhookController {
  private webhookService = Container.get(StripeWebhookService);

  @Post("/stripe")
  async handleStripeWebhook(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const payload = request.body;
    const signature = request.headers["stripe-signature"] as string;

    try {
      await this.webhookService.processWebhook(payload, signature);
      response.status(200).send("Webhook processed successfully");
    } catch (error) {
      console.error("Webhook processing failed:", error);
      response.status(400).send("Webhook processing failed");
    }
  }
}
```

### 2. Raw Body Middleware

```typescript
// src/app.ts
import express from "express";

// Configure raw body parsing for webhooks BEFORE JSON middleware
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));

// Then configure JSON middleware for other routes
app.use(express.json());
```

### 3. Webhook Service Implementation

```typescript
// src/services/stripe-webhook.service.ts
import { Service } from "typedi";
import Stripe from "stripe";
import { config } from "../config/env";

@Service()
export class StripeWebhookService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: config.stripe.apiVersion,
    });
  }

  async processWebhook(payload: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.webhookSecret,
      );
    } catch (error) {
      throw new Error(
        `Webhook signature verification failed: ${error.message}`,
      );
    }

    // Check if event was already processed
    if (await this.isEventProcessed(event.id)) {
      console.log(`Event ${event.id} already processed, skipping`);
      return;
    }

    // Log webhook event
    await this.logWebhookEvent(event);

    // Process event based on type
    await this.handleEvent(event);

    // Mark event as processed
    await this.markEventAsProcessed(event.id);
  }

  private async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "payment_intent.succeeded":
        await this.handlePaymentIntentSucceeded(event);
        break;
      case "payment_intent.payment_failed":
        await this.handlePaymentIntentFailed(event);
        break;
      case "customer.subscription.created":
        await this.handleSubscriptionCreated(event);
        break;
      case "customer.subscription.updated":
        await this.handleSubscriptionUpdated(event);
        break;
      case "customer.subscription.deleted":
        await this.handleSubscriptionDeleted(event);
        break;
      case "invoice.payment_succeeded":
        await this.handleInvoicePaymentSucceeded(event);
        break;
      case "invoice.payment_failed":
        await this.handleInvoicePaymentFailed(event);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handlePaymentIntentSucceeded(
    event: Stripe.Event,
  ): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    // Update payment status in database
    await this.updatePaymentStatus(paymentIntent.id, "succeeded");

    // Send confirmation email
    await this.sendPaymentConfirmation(paymentIntent);

    // Handle any business logic (e.g., activate service, send products)
    await this.handleSuccessfulPayment(paymentIntent);
  }

  private async handlePaymentIntentFailed(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    // Update payment status in database
    await this.updatePaymentStatus(paymentIntent.id, "failed");

    // Send failure notification
    await this.sendPaymentFailureNotification(paymentIntent);

    // Handle retry logic if needed
    await this.handleFailedPayment(paymentIntent);
  }

  private async handleSubscriptionCreated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    // Create subscription record in database
    await this.createSubscriptionRecord(subscription);

    // Send welcome email
    await this.sendSubscriptionWelcome(subscription);

    // Activate user account/features
    await this.activateSubscription(subscription);
  }

  private async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    // Update subscription in database
    await this.updateSubscriptionRecord(subscription);

    // Handle status changes
    await this.handleSubscriptionStatusChange(subscription);
  }

  private async handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    // Update subscription status to canceled
    await this.cancelSubscriptionRecord(subscription);

    // Send cancellation confirmation
    await this.sendCancellationConfirmation(subscription);

    // Deactivate user features
    await this.deactivateSubscription(subscription);
  }

  private async handleInvoicePaymentSucceeded(
    event: Stripe.Event,
  ): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;

    // Update billing status
    await this.updateBillingStatus(invoice.subscription as string, "paid");

    // Send receipt
    await this.sendInvoiceReceipt(invoice);

    // Extend subscription period
    await this.extendSubscriptionPeriod(invoice);
  }

  private async handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;

    // Update billing status
    await this.updateBillingStatus(invoice.subscription as string, "past_due");

    // Send payment failure notification
    await this.sendInvoicePaymentFailure(invoice);

    // Handle dunning management
    await this.handleDunningManagement(invoice);
  }

  // Helper methods
  private async isEventProcessed(eventId: string): Promise<boolean> {
    // Check if event exists in webhook_events table
    // Implementation depends on your database setup
    return false;
  }

  private async markEventAsProcessed(eventId: string): Promise<void> {
    // Mark event as processed in webhook_events table
    // Implementation depends on your database setup
  }

  private async logWebhookEvent(event: Stripe.Event): Promise<void> {
    // Log event to webhook_events table
    // Implementation depends on your database setup
  }
}
```

## Webhook Security

### Signature Verification

```typescript
// Always verify webhook signatures
const verifyWebhookSignature = (
  payload: Buffer,
  signature: string,
): boolean => {
  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      config.stripe.webhookSecret,
    );
    return true;
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return false;
  }
};
```

### Rate Limiting

```typescript
// Apply rate limiting to webhook endpoints
import rateLimit from "express-rate-limit";

const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many webhook requests from this IP",
});

app.use("/api/webhooks", webhookLimiter);
```

## Error Handling

### Webhook Retry Logic

```typescript
// Implement retry logic for failed webhooks
class WebhookRetryManager {
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  async processWithRetry(
    eventId: string,
    processor: () => Promise<void>,
  ): Promise<void> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await processor();
        return; // Success
      } catch (error) {
        console.error(`Webhook processing attempt ${attempt} failed:`, error);

        if (attempt === this.maxRetries) {
          // Final attempt failed, log to dead letter queue
          await this.logToDeadLetterQueue(eventId, error);
          throw error;
        }

        // Wait before retry
        await this.delay(this.retryDelay * attempt);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async logToDeadLetterQueue(
    eventId: string,
    error: Error,
  ): Promise<void> {
    // Log failed webhook to dead letter queue for manual processing
    console.error(
      `Webhook ${eventId} failed after ${this.maxRetries} attempts:`,
      error,
    );
  }
}
```

### Error Response

```typescript
// Proper error responses for webhooks
app.post("/api/webhooks/stripe", async (req, res) => {
  try {
    await webhookService.processWebhook(
      req.body,
      req.headers["stripe-signature"],
    );
    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);

    if (error.message.includes("signature")) {
      res.status(400).send("Invalid signature");
    } else {
      res.status(500).send("Internal server error");
    }
  }
});
```

## Testing Webhooks

### Local Testing with Stripe CLI

```bash
# Install Stripe CLI
npm install -g stripe-cli

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Test specific events
stripe trigger payment_intent.succeeded
stripe trigger customer.subscription.created
stripe trigger invoice.payment_failed
```

### Testing Webhook Endpoints

```typescript
// Test webhook signature verification
describe("Webhook Security", () => {
  it("should verify valid webhook signature", async () => {
    const payload = Buffer.from(JSON.stringify(mockEvent));
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: config.stripe.webhookSecret,
    });

    const result = await webhookService.verifyWebhookSignature(
      payload,
      signature,
    );
    expect(result).toBe(true);
  });

  it("should reject invalid webhook signature", async () => {
    const payload = Buffer.from(JSON.stringify(mockEvent));
    const invalidSignature = "invalid_signature";

    expect(() => {
      webhookService.verifyWebhookSignature(payload, invalidSignature);
    }).toThrow("Webhook signature verification failed");
  });
});
```

## Monitoring and Logging

### Webhook Monitoring

```typescript
// Monitor webhook processing
class WebhookMonitor {
  private metrics = {
    processed: 0,
    failed: 0,
    retries: 0,
    averageProcessingTime: 0,
  };

  async trackWebhookProcessing(
    eventId: string,
    processor: () => Promise<void>,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      await processor();
      this.metrics.processed++;
    } catch (error) {
      this.metrics.failed++;
      throw error;
    } finally {
      const processingTime = Date.now() - startTime;
      this.updateAverageProcessingTime(processingTime);
    }
  }

  private updateAverageProcessingTime(newTime: number): void {
    const totalEvents = this.metrics.processed + this.metrics.failed;
    this.metrics.averageProcessingTime =
      (this.metrics.averageProcessingTime * (totalEvents - 1) + newTime) /
      totalEvents;
  }

  getMetrics() {
    return { ...this.metrics };
  }
}
```

### Webhook Logging

```typescript
// Comprehensive webhook logging
class WebhookLogger {
  async logWebhookEvent(event: Stripe.Event): Promise<void> {
    const logEntry = {
      eventId: event.id,
      eventType: event.type,
      created: new Date(event.created * 1000),
      livemode: event.livemode,
      apiVersion: event.api_version,
      data: event.data,
      timestamp: new Date(),
    };

    await this.saveLogEntry(logEntry);
  }

  async logProcessingError(eventId: string, error: Error): Promise<void> {
    const errorLog = {
      eventId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date(),
    };

    await this.saveErrorLog(errorLog);
  }

  private async saveLogEntry(entry: any): Promise<void> {
    // Save to database or logging service
  }

  private async saveErrorLog(error: any): Promise<void> {
    // Save error to database or logging service
  }
}
```

## Best Practices

### 1. Idempotency

```typescript
// Ensure webhook events are processed only once
const processWebhookIdempotently = async (
  event: Stripe.Event,
): Promise<void> => {
  const eventId = event.id;

  // Check if already processed
  if (await isEventProcessed(eventId)) {
    console.log(`Event ${eventId} already processed, skipping`);
    return;
  }

  // Process event
  await processEvent(event);

  // Mark as processed
  await markEventAsProcessed(eventId);
};
```

### 2. Database Transactions

```typescript
// Use database transactions for webhook processing
const processWebhookWithTransaction = async (
  event: Stripe.Event,
): Promise<void> => {
  const transaction = await database.beginTransaction();

  try {
    // Process event within transaction
    await processEventData(event, transaction);

    // Mark event as processed
    await markEventAsProcessed(event.id, transaction);

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
```

### 3. Graceful Degradation

```typescript
// Handle webhook failures gracefully
const processWebhookSafely = async (event: Stripe.Event): Promise<void> => {
  try {
    await processWebhookEvent(event);
  } catch (error) {
    // Log error but don't fail the webhook
    console.error("Webhook processing failed:", error);

    // Queue for retry
    await queueForRetry(event);

    // Continue processing other events
  }
};
```

## Troubleshooting

### Common Issues

1. **Webhook Signature Verification Fails**
   - Check webhook secret configuration
   - Ensure raw body is used for signature verification
   - Verify webhook endpoint URL

2. **Duplicate Event Processing**
   - Implement idempotency checks
   - Use event ID to prevent duplicate processing
   - Check database constraints

3. **Webhook Timeouts**
   - Optimize webhook processing time
   - Use asynchronous processing where possible
   - Implement proper error handling

4. **Database Sync Issues**
   - Use database transactions
   - Implement proper error handling
   - Add data validation

### Debug Steps

1. **Check Webhook Logs**

   ```bash
   # View webhook logs in Stripe dashboard
   # Check application logs for errors
   ```

2. **Test Webhook Locally**

   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   stripe trigger payment_intent.succeeded
   ```

3. **Verify Configuration**
   ```typescript
   console.log("Webhook secret:", config.stripe.webhookSecret);
   console.log("Webhook endpoint:", "/api/webhooks/stripe");
   ```

## Related Documentation

- [Stripe Integration Guide](./stripe-integration.md)
- [Stripe API Reference](./stripe-api-reference.md)
- [Stripe Configuration Guide](./stripe-configuration-guide.md)
- [Stripe Testing Guide](./stripe-testing-guide.md)
