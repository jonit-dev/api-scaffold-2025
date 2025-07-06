import { Service } from "typedi";
import Stripe from "stripe";
import { StripeService } from "./stripe.service";
import { StripeCustomerService } from "./stripe-customer.service";
import {
  ICreatePaymentIntentData,
  IConfirmPaymentData,
  IRefundData,
  StripePaymentIntent,
} from "../types/stripe.types";
import {
  handleStripeError,
  StripePaymentException,
} from "../exceptions/stripe.exception";
import { BadRequestException } from "../exceptions/http-exceptions";
import { config } from "../config/env";

@Service()
export class StripePaymentService {
  private stripe: Stripe;

  constructor(
    private stripeService: StripeService,
    private customerService: StripeCustomerService,
  ) {
    this.stripe = this.stripeService.getStripeInstance();
  }

  async createPaymentIntent(
    data: ICreatePaymentIntentData,
  ): Promise<StripePaymentIntent> {
    try {
      // Validate amount
      this.validatePaymentAmount(data.amount);

      // Ensure customer exists
      await this.customerService.getCustomer(data.customerId);

      const createParams: Stripe.PaymentIntentCreateParams = {
        amount: data.amount,
        currency: data.currency,
        customer: data.customerId,
        automatic_payment_methods: {
          enabled: true,
        },
        capture_method:
          data.captureMethod ||
          (config.payment.autoCapture ? "automatic" : "manual"),
        description: data.description,
        metadata: {
          ...data.metadata,
          created_by: "api-scaffold",
        },
      };

      if (data.paymentMethodId) {
        createParams.payment_method = data.paymentMethodId;
        createParams.confirm = true;
        createParams.return_url = config.env.frontendUrl;
      }

      const paymentIntent =
        await this.stripe.paymentIntents.create(createParams);

      // TODO: Create local payment record for audit trail
      // This would require proper database integration

      return paymentIntent;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripePaymentException(
        `Failed to create payment intent: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async confirmPaymentIntent(
    paymentIntentId: string,
    data?: IConfirmPaymentData,
  ): Promise<StripePaymentIntent> {
    try {
      const confirmParams: Stripe.PaymentIntentConfirmParams = {
        return_url: data?.returnUrl || config.env.frontendUrl,
      };

      if (data?.paymentMethodId) {
        confirmParams.payment_method = data.paymentMethodId;
      }

      const paymentIntent = await this.stripe.paymentIntents.confirm(
        paymentIntentId,
        confirmParams,
      );

      return paymentIntent;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripePaymentException(
        `Failed to confirm payment intent: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async capturePaymentIntent(
    paymentIntentId: string,
    amountToCapture?: number,
  ): Promise<StripePaymentIntent> {
    try {
      const captureParams: Stripe.PaymentIntentCaptureParams = {};

      if (amountToCapture !== undefined) {
        captureParams.amount_to_capture = amountToCapture;
      }

      const paymentIntent = await this.stripe.paymentIntents.capture(
        paymentIntentId,
        captureParams,
      );

      return paymentIntent;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripePaymentException(
        `Failed to capture payment intent: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async cancelPaymentIntent(
    paymentIntentId: string,
  ): Promise<StripePaymentIntent> {
    try {
      const paymentIntent =
        await this.stripe.paymentIntents.cancel(paymentIntentId);

      return paymentIntent;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripePaymentException(
        `Failed to cancel payment intent: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async createRefund(data: IRefundData): Promise<Stripe.Refund> {
    try {
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: data.paymentIntentId,
        reason: data.reason,
        metadata: {
          ...data.metadata,
          created_by: "api-scaffold",
        },
      };

      if (data.amount !== undefined) {
        refundParams.amount = data.amount;
      }

      const refund = await this.stripe.refunds.create(refundParams);

      return refund;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripePaymentException(
        `Failed to create refund: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getRefund(refundId: string): Promise<Stripe.Refund> {
    try {
      const refund = await this.stripe.refunds.retrieve(refundId);
      return refund;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripePaymentException(
        `Failed to retrieve refund: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getPaymentIntent(
    paymentIntentId: string,
  ): Promise<StripePaymentIntent> {
    try {
      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripePaymentException(
        `Failed to retrieve payment intent: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async listPaymentIntents(
    customerId: string,
    limit: number = 10,
    startingAfter?: string,
  ): Promise<Stripe.PaymentIntent[]> {
    try {
      const paymentIntents = await this.stripe.paymentIntents.list({
        customer: customerId,
        limit,
        starting_after: startingAfter,
      });

      return paymentIntents.data;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripePaymentException(
        `Failed to list payment intents: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string,
  ): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(
        paymentMethodId,
        { customer: customerId },
      );

      return paymentMethod;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripePaymentException(
        `Failed to attach payment method: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async detachPaymentMethod(
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod =
        await this.stripe.paymentMethods.detach(paymentMethodId);

      return paymentMethod;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripePaymentException(
        `Failed to detach payment method: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async createSetupIntent(
    customerId: string,
    paymentMethodTypes: string[] = ["card"],
  ): Promise<Stripe.SetupIntent> {
    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: paymentMethodTypes,
        usage: "off_session",
      });

      return setupIntent;
    } catch (error) {
      if (error && typeof error === "object" && "type" in error) {
        throw handleStripeError(error as Stripe.StripeRawError);
      }
      throw new StripePaymentException(
        `Failed to create setup intent: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private validatePaymentAmount(amount: number): void {
    if (amount < config.payment.minPaymentAmount) {
      throw new BadRequestException(
        `Payment amount must be at least ${config.payment.minPaymentAmount} cents`,
      );
    }

    if (amount > config.payment.maxPaymentAmount) {
      throw new BadRequestException(
        `Payment amount cannot exceed ${config.payment.maxPaymentAmount} cents`,
      );
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException(
        "Payment amount must be a positive integer representing cents",
      );
    }
  }

  async calculateApplicationFee(
    amount: number,
    feePercentage: number,
  ): Promise<number> {
    if (feePercentage < 0 || feePercentage > 100) {
      throw new BadRequestException("Fee percentage must be between 0 and 100");
    }

    return Math.round(amount * (feePercentage / 100));
  }
}
