import Stripe from "stripe";

// Customer-related types
export interface ICreateCustomerData {
  email: string;
  name?: string;
  phone?: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface IUpdateCustomerData {
  name?: string;
  phone?: string;
  email?: string;
  description?: string;
  metadata?: Record<string, string>;
}

// Payment-related types
export interface ICreatePaymentIntentData {
  amount: number;
  currency: string;
  customerId: string;
  paymentMethodId?: string;
  captureMethod?: "automatic" | "manual";
  description?: string;
  metadata?: Record<string, string>;
}

export interface IConfirmPaymentData {
  paymentIntentId: string;
  paymentMethodId?: string;
  returnUrl?: string;
}

export interface IRefundData {
  paymentIntentId: string;
  amount?: number;
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
  metadata?: Record<string, string>;
}

// Subscription-related types
export interface ICreateSubscriptionData {
  customerId: string;
  priceId: string;
  quantity?: number;
  trialPeriodDays?: number;
  paymentMethodId?: string;
  prorationBehavior?: "create_prorations" | "none" | "always_invoice";
  metadata?: Record<string, string>;
}

export interface IUpdateSubscriptionData {
  priceId?: string;
  quantity?: number;
  prorationBehavior?: "create_prorations" | "none" | "always_invoice";
  metadata?: Record<string, string>;
}

export interface ICreateProductData {
  name: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface ICreatePriceData {
  productId: string;
  unitAmount: number;
  currency: string;
  recurring: {
    interval: "month" | "year" | "week" | "day";
    intervalCount?: number;
  };
  metadata?: Record<string, string>;
}

// Database entity types
export interface IPayment {
  id: string;
  stripePaymentIntentId: string;
  userId: string;
  customerId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

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
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Webhook-related types
export interface IWebhookEvent {
  id: string;
  stripeEventId: string;
  eventType: string;
  processed: boolean;
  processedAt?: Date;
  payload: unknown;
  createdAt: Date;
}

// Enums
export enum PaymentStatus {
  REQUIRES_PAYMENT_METHOD = "requires_payment_method",
  REQUIRES_CONFIRMATION = "requires_confirmation",
  REQUIRES_ACTION = "requires_action",
  PROCESSING = "processing",
  REQUIRES_CAPTURE = "requires_capture",
  CANCELED = "canceled",
  SUCCEEDED = "succeeded",
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

export enum StripeWebhookEventType {
  PAYMENT_INTENT_SUCCEEDED = "payment_intent.succeeded",
  PAYMENT_INTENT_FAILED = "payment_intent.payment_failed",
  CUSTOMER_CREATED = "customer.created",
  CUSTOMER_UPDATED = "customer.updated",
  CUSTOMER_DELETED = "customer.deleted",
  INVOICE_PAYMENT_SUCCEEDED = "invoice.payment_succeeded",
  INVOICE_PAYMENT_FAILED = "invoice.payment_failed",
  SUBSCRIPTION_CREATED = "customer.subscription.created",
  SUBSCRIPTION_UPDATED = "customer.subscription.updated",
  SUBSCRIPTION_DELETED = "customer.subscription.deleted",
  SUBSCRIPTION_TRIAL_WILL_END = "customer.subscription.trial_will_end",
  INVOICE_UPCOMING = "invoice.upcoming",
}

// API Response types
export interface IApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// Query types
export interface IPaymentHistoryQuery {
  customerId?: string;
  status?: PaymentStatus;
  limit?: number;
  page?: number;
  startDate?: string;
  endDate?: string;
}

export interface ISubscriptionQuery {
  customerId?: string;
  status?: SubscriptionStatus;
  limit?: number;
  page?: number;
}

// Export Stripe types for convenience
export type StripeCustomer = Stripe.Customer;
export type StripePaymentIntent = Stripe.PaymentIntent;
export type StripeSubscription = Stripe.Subscription;
export type StripeProduct = Stripe.Product;
export type StripePrice = Stripe.Price;
export type StripeEvent = Stripe.Event;
export type StripeError = Stripe.StripeRawError;
