import { Service } from "typedi";
import Stripe from "stripe";
import { StripeService } from "./stripe.service";
import { StripeCustomerService } from "./stripe-customer.service";
import {
  ICreateSubscriptionData,
  IUpdateSubscriptionData,
  ICreateProductData,
  ICreatePriceData,
  StripeSubscription,
  StripeProduct,
  StripePrice,
} from "../types/stripe.types";
import {
  handleStripeError,
  StripeSubscriptionException,
} from "../exceptions/stripe.exception";
import { BadRequestException } from "../exceptions/http-exceptions";
import { config } from "../config/env";

@Service()
export class StripeSubscriptionService {
  private stripe: Stripe;

  constructor(
    private stripeService: StripeService,
    private customerService: StripeCustomerService,
  ) {
    this.stripe = this.stripeService.getStripeInstance();
  }

  // Subscription lifecycle methods
  async createSubscription(
    data: ICreateSubscriptionData,
  ): Promise<StripeSubscription> {
    try {
      // Ensure customer exists
      await this.customerService.getCustomer(data.customerId);

      const createParams: Stripe.SubscriptionCreateParams = {
        customer: data.customerId,
        items: [
          {
            price: data.priceId,
            quantity: data.quantity || 1,
          },
        ],
        metadata: {
          ...data.metadata,
          created_by: "api-scaffold",
        },
        expand: ["latest_invoice.payment_intent"],
      };

      if (data.trialPeriodDays) {
        createParams.trial_period_days = data.trialPeriodDays;
      }

      if (data.paymentMethodId) {
        createParams.default_payment_method = data.paymentMethodId;
      }

      if (data.prorationBehavior) {
        createParams.proration_behavior = data.prorationBehavior;
      }

      const subscription = await this.stripe.subscriptions.create(createParams);

      return subscription;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeSubscriptionException(
        `Failed to create subscription: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async updateSubscription(
    subscriptionId: string,
    data: IUpdateSubscriptionData,
  ): Promise<StripeSubscription> {
    try {
      const updateParams: Stripe.SubscriptionUpdateParams = {
        metadata: data.metadata,
      };

      if (data.priceId) {
        // Get current subscription to update items
        const currentSubscription = await this.getSubscription(subscriptionId);
        const currentItem = currentSubscription.items.data[0];

        updateParams.items = [
          {
            id: currentItem.id,
            price: data.priceId,
            quantity: data.quantity || currentItem.quantity,
          },
        ];
      }

      if (data.prorationBehavior) {
        updateParams.proration_behavior = data.prorationBehavior;
      }

      const subscription = await this.stripe.subscriptions.update(
        subscriptionId,
        updateParams,
      );

      return subscription;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeSubscriptionException(
        `Failed to update subscription: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = false,
  ): Promise<StripeSubscription> {
    try {
      if (cancelAtPeriodEnd) {
        const subscription = await this.stripe.subscriptions.update(
          subscriptionId,
          {
            cancel_at_period_end: true,
          },
        );
        return subscription;
      } else {
        const subscription =
          await this.stripe.subscriptions.cancel(subscriptionId);
        return subscription;
      }
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeSubscriptionException(
        `Failed to cancel subscription: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async pauseSubscription(subscriptionId: string): Promise<StripeSubscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(
        subscriptionId,
        {
          pause_collection: {
            behavior: "mark_uncollectible",
          },
        },
      );

      return subscription;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeSubscriptionException(
        `Failed to pause subscription: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async resumeSubscription(
    subscriptionId: string,
  ): Promise<StripeSubscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(
        subscriptionId,
        {
          pause_collection: "",
        },
      );

      return subscription;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeSubscriptionException(
        `Failed to resume subscription: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Plan management methods
  async changeSubscriptionPlan(
    subscriptionId: string,
    newPriceId: string,
  ): Promise<StripeSubscription> {
    try {
      const subscription = await this.getSubscription(subscriptionId);
      const currentItem = subscription.items.data[0];

      const updatedSubscription = await this.stripe.subscriptions.update(
        subscriptionId,
        {
          items: [
            {
              id: currentItem.id,
              price: newPriceId,
            },
          ],
          proration_behavior: config.subscription
            .prorationBehavior as "create_prorations",
        },
      );

      return updatedSubscription;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeSubscriptionException(
        `Failed to change subscription plan: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async addSubscriptionItem(
    subscriptionId: string,
    priceId: string,
    quantity: number = 1,
  ): Promise<StripeSubscription> {
    try {
      await this.stripe.subscriptionItems.create({
        subscription: subscriptionId,
        price: priceId,
        quantity,
      });

      return await this.getSubscription(subscriptionId);
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeSubscriptionException(
        `Failed to add subscription item: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async removeSubscriptionItem(
    subscriptionId: string,
    itemId: string,
  ): Promise<StripeSubscription> {
    try {
      await this.stripe.subscriptionItems.del(itemId);
      return await this.getSubscription(subscriptionId);
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeSubscriptionException(
        `Failed to remove subscription item: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Billing and invoicing methods
  async previewUpcomingInvoice(
    subscriptionId: string,
  ): Promise<Stripe.Invoice> {
    try {
      const upcomingInvoice = await this.stripe.invoices.list({
        subscription: subscriptionId,
        limit: 1,
      });

      const invoice = upcomingInvoice.data[0] || null;
      if (!invoice) {
        throw new Error("No upcoming invoice found");
      }

      return invoice;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeSubscriptionException(
        `Failed to preview upcoming invoice: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async createProrationPreview(
    subscriptionId: string,
  ): Promise<Stripe.Invoice> {
    try {
      await this.getSubscription(subscriptionId);

      // For proration preview, we'll return a simulated invoice
      // In a real implementation, you would use Stripe's invoice preview API
      const invoice = {
        id: "in_preview",
        amount_due: 0,
        subscription: subscriptionId,
        lines: {
          data: [],
        },
      } as unknown as Stripe.Invoice;

      return invoice;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeSubscriptionException(
        `Failed to create proration preview: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async updateSubscriptionQuantity(
    subscriptionId: string,
    quantity: number,
  ): Promise<StripeSubscription> {
    try {
      const subscription = await this.getSubscription(subscriptionId);
      const currentItem = subscription.items.data[0];

      const updatedSubscription = await this.stripe.subscriptions.update(
        subscriptionId,
        {
          items: [
            {
              id: currentItem.id,
              quantity,
            },
          ],
        },
      );

      return updatedSubscription;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeSubscriptionException(
        `Failed to update subscription quantity: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Utility methods
  async getSubscription(subscriptionId: string): Promise<StripeSubscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(
        subscriptionId,
        {
          expand: ["latest_invoice.payment_intent"],
        },
      );

      return subscription;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeSubscriptionException(
        `Failed to retrieve subscription: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async listCustomerSubscriptions(
    customerId: string,
    status?: string,
  ): Promise<StripeSubscription[]> {
    try {
      const params: Stripe.SubscriptionListParams = {
        customer: customerId,
        expand: ["data.latest_invoice.payment_intent"],
      };

      if (status) {
        params.status = status as Stripe.SubscriptionListParams.Status;
      }

      const subscriptions = await this.stripe.subscriptions.list(params);

      return subscriptions.data;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeSubscriptionException(
        `Failed to list customer subscriptions: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getSubscriptionUsage(subscriptionId: string): Promise<unknown[]> {
    try {
      const subscription = await this.getSubscription(subscriptionId);
      const subscriptionItem = subscription.items.data[0];

      if (!subscriptionItem) {
        throw new BadRequestException("Subscription has no items");
      }

      // Note: Usage records are typically handled differently in modern Stripe API
      // This is a placeholder for usage-based billing functionality
      return [];
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeSubscriptionException(
        `Failed to get subscription usage: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Product and Price management
  async createProduct(data: ICreateProductData): Promise<StripeProduct> {
    try {
      const product = await this.stripe.products.create({
        name: data.name,
        description: data.description,
        metadata: {
          ...data.metadata,
          created_by: "api-scaffold",
        },
      });

      return product;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeSubscriptionException(
        `Failed to create product: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async createPrice(data: ICreatePriceData): Promise<StripePrice> {
    try {
      const price = await this.stripe.prices.create({
        product: data.productId,
        unit_amount: data.unitAmount,
        currency: data.currency,
        recurring: {
          interval: data.recurring.interval,
          interval_count: data.recurring.intervalCount || 1,
        },
        metadata: {
          ...data.metadata,
          created_by: "api-scaffold",
        },
      });

      return price;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeSubscriptionException(
        `Failed to create price: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async listProducts(active: boolean = true): Promise<StripeProduct[]> {
    try {
      const products = await this.stripe.products.list({
        active,
        expand: ["data.default_price"],
      });

      return products.data;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeSubscriptionException(
        `Failed to list products: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async listPrices(
    productId?: string,
    active: boolean = true,
  ): Promise<StripePrice[]> {
    try {
      const params: Stripe.PriceListParams = {
        active,
      };

      if (productId) {
        params.product = productId;
      }

      const prices = await this.stripe.prices.list(params);

      return prices.data;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeSubscriptionException(
        `Failed to list prices: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async archiveProduct(productId: string): Promise<StripeProduct> {
    try {
      const product = await this.stripe.products.update(productId, {
        active: false,
      });

      return product;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeSubscriptionException(
        `Failed to archive product: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async archivePrice(priceId: string): Promise<StripePrice> {
    try {
      const price = await this.stripe.prices.update(priceId, {
        active: false,
      });

      return price;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripeSubscriptionException(
        `Failed to archive price: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
