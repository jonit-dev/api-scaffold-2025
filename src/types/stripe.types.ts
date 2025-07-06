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
  RequiresPaymentMethod = "RequiresPaymentMethod",
  RequiresConfirmation = "RequiresConfirmation",
  RequiresAction = "RequiresAction",
  Processing = "Processing",
  RequiresCapture = "RequiresCapture",
  Canceled = "Canceled",
  Succeeded = "Succeeded",
}

export enum SubscriptionStatus {
  Active = "Active",
  PastDue = "PastDue",
  Unpaid = "Unpaid",
  Canceled = "Canceled",
  Incomplete = "Incomplete",
  IncompleteExpired = "IncompleteExpired",
  Trialing = "Trialing",
  Paused = "Paused",
}

export enum StripeWebhookEventType {
  PaymentIntentSucceeded = "payment_intent.succeeded",
  PaymentIntentFailed = "payment_intent.payment_failed",
  CustomerCreated = "customer.created",
  CustomerUpdated = "customer.updated",
  CustomerDeleted = "customer.deleted",
  InvoicePaymentSucceeded = "invoice.payment_succeeded",
  InvoicePaymentFailed = "invoice.payment_failed",
  SubscriptionCreated = "customer.subscription.created",
  SubscriptionUpdated = "customer.subscription.updated",
  SubscriptionDeleted = "customer.subscription.deleted",
  SubscriptionTrialWillEnd = "customer.subscription.trial_will_end",
  InvoiceUpcoming = "invoice.upcoming",
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
