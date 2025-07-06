import {
  JsonController,
  Post,
  Get,
  Put,
  Body,
  Param,
  QueryParam,
  UseBefore,
  Req,
  Res,
} from "routing-controllers";
import { Service } from "typedi";
import { Request, Response } from "express";
import { AuthMiddleware } from "../middlewares/auth.middleware";
import { StripeCustomerService } from "../services/stripe-customer.service";
import { StripePaymentService } from "../services/stripe-payment.service";
import { StripeSubscriptionService } from "../services/stripe-subscription.service";
import { StripeWebhookService } from "../services/stripe-webhook.service";
import { PaymentRepository } from "../repositories/payment.repository";
import { SubscriptionRepository } from "../repositories/subscription.repository";
import { CreateCustomerDto } from "../models/dtos/stripe/create-customer.dto";
import { CreatePaymentIntentDto } from "../models/dtos/stripe/create-payment-intent.dto";
import { ConfirmPaymentDto } from "../models/dtos/stripe/confirm-payment.dto";
import { RefundPaymentDto } from "../models/dtos/stripe/refund-payment.dto";
import { CreateSubscriptionDto } from "../models/dtos/stripe/create-subscription.dto";
import { ApiResponseDto } from "../models/dtos/common/api-response.dto";
import { IAuthenticatedRequest } from "../types/express";
import { PaymentStatus, SubscriptionStatus } from "../types/stripe.types";

@Service()
@JsonController("/stripe")
export class StripeController {
  constructor(
    private stripeCustomerService: StripeCustomerService,
    private stripePaymentService: StripePaymentService,
    private stripeSubscriptionService: StripeSubscriptionService,
    private stripeWebhookService: StripeWebhookService,
    private paymentRepository: PaymentRepository,
    private subscriptionRepository: SubscriptionRepository,
  ) {}

  // Customer endpoints
  @Post("/customers")
  @UseBefore(AuthMiddleware)
  async createCustomer(
    @Body() createCustomerDto: CreateCustomerDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Req() req: IAuthenticatedRequest,
  ): Promise<ApiResponseDto<object>> {
    const customer =
      await this.stripeCustomerService.createCustomer(createCustomerDto);

    return ApiResponseDto.success("Customer created successfully", {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      created: customer.created,
    });
  }

  @Get("/customers/sync")
  @UseBefore(AuthMiddleware)
  async syncCustomer(
    @Req() req: IAuthenticatedRequest,
  ): Promise<ApiResponseDto<object>> {
    const customer = await this.stripeCustomerService.syncCustomerWithUser(
      req.user.id,
    );

    return ApiResponseDto.success("Customer synced successfully", {
      id: customer.id,
      email: customer.email,
      name: customer.name,
    });
  }

  @Get("/customers/:customerId")
  @UseBefore(AuthMiddleware)
  async getCustomer(
    @Param("customerId") customerId: string,
  ): Promise<ApiResponseDto<object>> {
    const customer = await this.stripeCustomerService.getCustomer(customerId);

    return ApiResponseDto.success("Customer retrieved successfully", {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      created: customer.created,
    });
  }

  @Get("/customers/:customerId/payment-methods")
  @UseBefore(AuthMiddleware)
  async getCustomerPaymentMethods(
    @Param("customerId") customerId: string,
  ): Promise<ApiResponseDto<object>> {
    const paymentMethods =
      await this.stripeCustomerService.getCustomerPaymentMethods(customerId);

    return ApiResponseDto.success(
      "Payment methods retrieved successfully",
      paymentMethods,
    );
  }

  // Payment endpoints
  @Post("/payment-intents")
  @UseBefore(AuthMiddleware)
  async createPaymentIntent(
    @Body() createPaymentIntentDto: CreatePaymentIntentDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Req() req: IAuthenticatedRequest,
  ): Promise<ApiResponseDto<object>> {
    const paymentIntent = await this.stripePaymentService.createPaymentIntent(
      createPaymentIntentDto,
    );

    return ApiResponseDto.success("Payment intent created successfully", {
      id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    });
  }

  @Post("/payment-intents/:paymentIntentId/confirm")
  @UseBefore(AuthMiddleware)
  async confirmPayment(
    @Param("paymentIntentId") paymentIntentId: string,
    @Body() confirmPaymentDto: ConfirmPaymentDto,
  ): Promise<ApiResponseDto<object>> {
    const paymentIntent = await this.stripePaymentService.confirmPaymentIntent(
      paymentIntentId,
      confirmPaymentDto,
    );

    return ApiResponseDto.success("Payment confirmed successfully", {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    });
  }

  @Post("/payment-intents/:paymentIntentId/refund")
  @UseBefore(AuthMiddleware)
  async refundPayment(
    @Param("paymentIntentId") paymentIntentId: string,
    @Body() refundPaymentDto: RefundPaymentDto,
  ): Promise<ApiResponseDto<object>> {
    const refund = await this.stripePaymentService.createRefund({
      paymentIntentId,
      amount: refundPaymentDto.amount,
      reason: refundPaymentDto.reason,
    });

    return ApiResponseDto.success("Payment refunded successfully", {
      id: refund.id,
      amount: refund.amount,
      status: refund.status,
      reason: refund.reason,
    });
  }

  @Get("/payments")
  @UseBefore(AuthMiddleware)
  async getUserPayments(
    @Req() req: IAuthenticatedRequest,
    @QueryParam("status") status?: PaymentStatus,
    @QueryParam("limit") limit = 20,
    @QueryParam("offset") offset = 0,
  ): Promise<ApiResponseDto<object>> {
    const payments = await this.paymentRepository.findByFilter(
      { userId: req.user.id, status },
      limit,
      offset,
    );

    return ApiResponseDto.success("Payments retrieved successfully", payments);
  }

  @Get("/payments/:paymentId")
  @UseBefore(AuthMiddleware)
  async getPayment(
    @Param("paymentId") paymentId: string,
  ): Promise<ApiResponseDto<object | null>> {
    const payment = await this.paymentRepository.findById(paymentId);

    return ApiResponseDto.success("Payment retrieved successfully", payment);
  }

  // Subscription endpoints
  @Post("/subscriptions")
  @UseBefore(AuthMiddleware)
  async createSubscription(
    @Body() createSubscriptionDto: CreateSubscriptionDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Req() req: IAuthenticatedRequest,
  ): Promise<ApiResponseDto<object>> {
    const subscription =
      await this.stripeSubscriptionService.createSubscription(
        createSubscriptionDto,
      );

    return ApiResponseDto.success("Subscription created successfully", {
      id: subscription.id,
      status: subscription.status,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      current_period_start: (subscription as any).current_period_start,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      current_period_end: (subscription as any).current_period_end,
      customer: subscription.customer,
    });
  }

  @Get("/subscriptions")
  @UseBefore(AuthMiddleware)
  async getUserSubscriptions(
    @Req() req: IAuthenticatedRequest,
    @QueryParam("status") status?: SubscriptionStatus,
  ): Promise<ApiResponseDto<object>> {
    const subscriptions = await this.subscriptionRepository.findByUserId(
      req.user.id,
    );

    const filteredSubscriptions = status
      ? subscriptions.filter((sub) => sub.status === status)
      : subscriptions;

    return ApiResponseDto.success(
      "Subscriptions retrieved successfully",
      filteredSubscriptions,
    );
  }

  @Get("/subscriptions/:subscriptionId")
  @UseBefore(AuthMiddleware)
  async getSubscription(
    @Param("subscriptionId") subscriptionId: string,
  ): Promise<ApiResponseDto<object>> {
    const subscription =
      await this.stripeSubscriptionService.getSubscription(subscriptionId);

    return ApiResponseDto.success("Subscription retrieved successfully", {
      id: subscription.id,
      status: subscription.status,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      current_period_start: (subscription as any).current_period_start,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      current_period_end: (subscription as any).current_period_end,
      customer: subscription.customer,
      items: subscription.items,
    });
  }

  @Put("/subscriptions/:subscriptionId/cancel")
  @UseBefore(AuthMiddleware)
  async cancelSubscription(
    @Param("subscriptionId") subscriptionId: string,
    @QueryParam("at_period_end") atPeriodEnd = false,
  ): Promise<ApiResponseDto<object>> {
    const subscription =
      await this.stripeSubscriptionService.cancelSubscription(
        subscriptionId,
        atPeriodEnd,
      );

    return ApiResponseDto.success("Subscription canceled successfully", {
      id: subscription.id,
      status: subscription.status,
      canceled_at: subscription.canceled_at,
      cancel_at_period_end: subscription.cancel_at_period_end,
    });
  }

  @Put("/subscriptions/:subscriptionId/pause")
  @UseBefore(AuthMiddleware)
  async pauseSubscription(
    @Param("subscriptionId") subscriptionId: string,
  ): Promise<ApiResponseDto<object>> {
    const subscription =
      await this.stripeSubscriptionService.pauseSubscription(subscriptionId);

    return ApiResponseDto.success("Subscription paused successfully", {
      id: subscription.id,
      status: subscription.status,
      pause_collection: subscription.pause_collection,
    });
  }

  @Put("/subscriptions/:subscriptionId/resume")
  @UseBefore(AuthMiddleware)
  async resumeSubscription(
    @Param("subscriptionId") subscriptionId: string,
  ): Promise<ApiResponseDto<object>> {
    const subscription =
      await this.stripeSubscriptionService.resumeSubscription(subscriptionId);

    return ApiResponseDto.success("Subscription resumed successfully", {
      id: subscription.id,
      status: subscription.status,
    });
  }

  // Product and pricing endpoints
  @Get("/products")
  async getProducts(
    @QueryParam("active") active = true,
  ): Promise<ApiResponseDto<object>> {
    const products = await this.stripeSubscriptionService.listProducts(active);

    return ApiResponseDto.success("Products retrieved successfully", products);
  }

  @Get("/products/:productId/prices")
  async getProductPrices(
    @Param("productId") productId: string,
    @QueryParam("active") active = true,
  ): Promise<ApiResponseDto<object>> {
    const prices = await this.stripeSubscriptionService.listPrices(
      productId,
      active,
    );

    return ApiResponseDto.success("Prices retrieved successfully", prices);
  }

  // Webhook endpoint
  @Post("/webhooks")
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<Response> {
    try {
      const signature = req.headers["stripe-signature"] as string;
      const body = req.body;

      await this.stripeWebhookService.processWebhook(body, signature);

      return res.status(200).json({ received: true });
    } catch (error) {
      // Keep console.error for webhook debugging - critical for Stripe integration
      console.error("Webhook error:", error);
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Utility endpoints
  @Get("/setup-intent")
  @UseBefore(AuthMiddleware)
  async createSetupIntent(
    @Req() req: IAuthenticatedRequest,
  ): Promise<ApiResponseDto<object>> {
    // Get or create customer for the user
    const customer = await this.stripeCustomerService.syncCustomerWithUser(
      req.user.id,
    );

    const setupIntent = await this.stripePaymentService.createSetupIntent(
      customer.id,
    );

    return ApiResponseDto.success("Setup intent created successfully", {
      id: setupIntent.id,
      client_secret: setupIntent.client_secret,
      status: setupIntent.status,
    });
  }
}
