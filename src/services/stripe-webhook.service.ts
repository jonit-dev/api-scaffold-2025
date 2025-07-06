import { Service } from "typedi";
import Stripe from "stripe";
import { StripeService } from "./stripe.service";
import { StripeCustomerService } from "./stripe-customer.service";
import { LoggerService } from "./logger.service";
import { StripeEvent, StripeWebhookEventType } from "../types/stripe.types";
import {
  handleStripeError,
  StripeWebhookException,
} from "../exceptions/stripe.exception";
import { config } from "../config/env";

@Service()
export class StripeWebhookService {
  private stripe: Stripe;
  private processedEvents: Set<string> = new Set();

  constructor(
    private stripeService: StripeService,
    private customerService: StripeCustomerService,
    private logger: LoggerService,
  ) {
    this.stripe = this.stripeService.getStripeInstance();
  }

  async processWebhook(payload: Buffer, signature: string): Promise<void> {
    try {
      const event = this.constructEvent(payload, signature);

      // Check if event was already processed
      if (await this.isEventProcessed(event.id)) {
        this.logger.info(`Event ${event.id} already processed, skipping`);
        return;
      }

      // Log the webhook event
      await this.logWebhookEvent(event);

      // Process the event based on its type
      await this.handleEvent(event);

      // Mark event as processed
      await this.markEventAsProcessed(event.id);

      this.logger.logStripeEvent(event.type, event.id, true);
    } catch (error) {
      this.logger.logError(error as Error, "Stripe webhook processing");
      throw error;
    }
  }

  private constructEvent(payload: Buffer, signature: string): StripeEvent {
    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        config.webhook.stripeEndpointSecret,
      );
    } catch (error) {
      throw new StripeWebhookException(
        `Webhook signature verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async handleEvent(event: StripeEvent): Promise<void> {
    try {
      switch (event.type) {
        case StripeWebhookEventType.PaymentIntentSucceeded:
          await this.handlePaymentIntentSucceeded(event);
          break;

        case StripeWebhookEventType.PaymentIntentFailed:
          await this.handlePaymentIntentFailed(event);
          break;

        case StripeWebhookEventType.CustomerCreated:
          await this.handleCustomerCreated(event);
          break;

        case StripeWebhookEventType.CustomerUpdated:
          await this.handleCustomerUpdated(event);
          break;

        case StripeWebhookEventType.CustomerDeleted:
          await this.handleCustomerDeleted(event);
          break;

        case StripeWebhookEventType.InvoicePaymentSucceeded:
          await this.handleInvoicePaymentSucceeded(event);
          break;

        case StripeWebhookEventType.InvoicePaymentFailed:
          await this.handleInvoicePaymentFailed(event);
          break;

        case StripeWebhookEventType.SubscriptionCreated:
          await this.handleSubscriptionCreated(event);
          break;

        case StripeWebhookEventType.SubscriptionUpdated:
          await this.handleSubscriptionUpdated(event);
          break;

        case StripeWebhookEventType.SubscriptionDeleted:
          await this.handleSubscriptionDeleted(event);
          break;

        case StripeWebhookEventType.SubscriptionTrialWillEnd:
          await this.handleSubscriptionTrialWillEnd(event);
          break;

        case StripeWebhookEventType.InvoiceUpcoming:
          await this.handleInvoiceUpcoming(event);
          break;

        default:
          this.logger.info(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`Error handling webhook event ${event.type}:`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  private async handlePaymentIntentSucceeded(
    event: StripeEvent,
  ): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    this.logger.info(`Payment succeeded: ${paymentIntent.id}`);

    // TODO: Update local payment record
    // TODO: Send payment confirmation email
    // TODO: Fulfill order/service
    // TODO: Update user account status if needed

    // Example notification logic
    if (paymentIntent.customer) {
      this.logger.info(
        `Payment successful for customer: ${paymentIntent.customer}`,
      );
    }
  }

  private async handlePaymentIntentFailed(event: StripeEvent): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    this.logger.info(`Payment failed: ${paymentIntent.id}`);

    // TODO: Update local payment record
    // TODO: Send payment failure notification
    // TODO: Handle retry logic if applicable

    if (paymentIntent.customer) {
      this.logger.info(
        `Payment failed for customer: ${paymentIntent.customer}`,
      );
    }
  }

  private async handleCustomerCreated(event: StripeEvent): Promise<void> {
    const customer = event.data.object as Stripe.Customer;

    this.logger.info(`Customer created: ${customer.id}`);

    // TODO: Sync with local user database if needed
    // TODO: Send welcome email
  }

  private async handleCustomerUpdated(event: StripeEvent): Promise<void> {
    const customer = event.data.object as Stripe.Customer;

    this.logger.info(`Customer updated: ${customer.id}`);

    // TODO: Sync changes with local user database
  }

  private async handleCustomerDeleted(event: StripeEvent): Promise<void> {
    const customer = event.data.object as Stripe.Customer;

    this.logger.info(`Customer deleted: ${customer.id}`);

    // TODO: Update local user record
    // TODO: Handle data cleanup
  }

  private async handleInvoicePaymentSucceeded(
    event: StripeEvent,
  ): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;

    this.logger.info(`Invoice payment succeeded: ${invoice.id}`);

    // TODO: Update subscription status
    // TODO: Send payment receipt
    // TODO: Provision services
  }

  private async handleInvoicePaymentFailed(event: StripeEvent): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;

    this.logger.info(`Invoice payment failed: ${invoice.id}`);

    // TODO: Handle dunning management
    // TODO: Send payment failure notification
    // TODO: Update subscription status
  }

  private async handleSubscriptionCreated(event: StripeEvent): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    this.logger.info(`Subscription created: ${subscription.id}`);

    // TODO: Create local subscription record
    // TODO: Send welcome email
    // TODO: Provision services
  }

  private async handleSubscriptionUpdated(event: StripeEvent): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    this.logger.info(`Subscription updated: ${subscription.id}`);

    // TODO: Update local subscription record
    // TODO: Handle proration if needed
    // TODO: Update service access
  }

  private async handleSubscriptionDeleted(event: StripeEvent): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    this.logger.info(`Subscription deleted: ${subscription.id}`);

    // TODO: Update local subscription record
    // TODO: Revoke service access
    // TODO: Send cancellation confirmation
  }

  private async handleSubscriptionTrialWillEnd(
    event: StripeEvent,
  ): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    this.logger.info(`Trial ending soon for subscription: ${subscription.id}`);

    // TODO: Send trial ending notification
    // TODO: Prompt for payment method if needed
  }

  private async handleInvoiceUpcoming(event: StripeEvent): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;

    this.logger.info(`Upcoming invoice: ${invoice.id}`);

    // TODO: Send upcoming invoice notification
    // TODO: Check payment method validity
  }

  async verifyWebhookSignature(
    payload: Buffer,
    signature: string,
  ): Promise<boolean> {
    try {
      this.constructEvent(payload, signature);
      return true;
    } catch {
      return false;
    }
  }

  private async logWebhookEvent(event: StripeEvent): Promise<void> {
    // TODO: Store webhook event in database for audit trail
    this.logger.info(`Webhook event received: ${event.type} (${event.id})`);
  }

  private async isEventProcessed(eventId: string): Promise<boolean> {
    // TODO: Check database for processed events
    // For now, use in-memory set (will reset on server restart)
    return this.processedEvents.has(eventId);
  }

  private async markEventAsProcessed(eventId: string): Promise<void> {
    // TODO: Store in database
    // For now, use in-memory set
    this.processedEvents.add(eventId);
  }

  async getWebhookEvent(eventId: string): Promise<StripeEvent> {
    try {
      const event = await this.stripe.events.retrieve(eventId);
      return event;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeWebhookException(
        `Failed to retrieve webhook event: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async listWebhookEvents(
    limit: number = 10,
    startingAfter?: string,
  ): Promise<Stripe.Event[]> {
    try {
      const events = await this.stripe.events.list({
        limit,
        starting_after: startingAfter,
      });

      return events.data;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeWebhookException(
        `Failed to list webhook events: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  generateTestEvent(eventType: string, data: unknown): string {
    const payload = {
      id: `evt_test_${Date.now()}`,
      object: "event",
      type: eventType,
      data: { object: data },
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
    };

    return JSON.stringify(payload, null, 2);
  }

  generateTestHeaderString(payload: string): string {
    return this.stripe.webhooks.generateTestHeaderString({
      payload,
      secret: config.webhook.stripeEndpointSecret,
    });
  }
}
