import Stripe from "stripe";
import { HttpException } from "./http-exceptions";
import { HttpStatus } from "../types/http-status";

export class StripeException extends HttpException {
  public readonly stripeCode?: string;
  public readonly declineCode?: string;
  public readonly param?: string;

  constructor(
    statusCode: HttpStatus,
    message: string,
    stripeCode?: string,
    declineCode?: string,
    param?: string,
    details?: unknown,
  ) {
    super(statusCode, message, details as never);
    this.stripeCode = stripeCode;
    this.declineCode = declineCode;
    this.param = param;
  }
}

export class StripeCardException extends StripeException {
  constructor(
    message: string,
    stripeCode?: string,
    declineCode?: string,
    param?: string,
  ) {
    super(HttpStatus.BadRequest, message, stripeCode, declineCode, param);
  }
}

export class StripeInvalidRequestException extends StripeException {
  constructor(message: string, param?: string) {
    super(
      HttpStatus.BadRequest,
      message,
      "invalid_request_error",
      undefined,
      param,
    );
  }
}

export class StripeAuthenticationException extends StripeException {
  constructor(message: string = "Invalid API key provided") {
    super(HttpStatus.Unauthorized, message, "authentication_error");
  }
}

export class StripePermissionException extends StripeException {
  constructor(
    message: string = "You do not have permission to perform this action",
  ) {
    super(HttpStatus.Forbidden, message, "permission_error");
  }
}

export class StripeRateLimitException extends StripeException {
  constructor(
    message: string = "Too many requests made to the API too quickly",
  ) {
    super(HttpStatus.TooManyRequests, message, "rate_limit_error");
  }
}

export class StripeApiException extends StripeException {
  constructor(message: string = "An error occurred with Stripe's API") {
    super(HttpStatus.InternalServerError, message, "api_error");
  }
}

export class StripeIdempotencyException extends StripeException {
  constructor(message: string = "Idempotency key already used") {
    super(HttpStatus.BadRequest, message, "idempotency_error");
  }
}

export class StripeConfigurationException extends StripeException {
  constructor(message: string = "Stripe configuration error") {
    super(HttpStatus.InternalServerError, message, "configuration_error");
  }
}

export class StripeWebhookException extends StripeException {
  constructor(message: string = "Webhook signature verification failed") {
    super(HttpStatus.BadRequest, message, "webhook_error");
  }
}

export class StripeCustomerException extends StripeException {
  constructor(message: string, statusCode: HttpStatus = HttpStatus.BadRequest) {
    super(statusCode, message, "customer_error");
  }
}

export class StripePaymentException extends StripeException {
  constructor(message: string, statusCode: HttpStatus = HttpStatus.BadRequest) {
    super(statusCode, message, "payment_error");
  }
}

export class StripeSubscriptionException extends StripeException {
  constructor(message: string, statusCode: HttpStatus = HttpStatus.BadRequest) {
    super(statusCode, message, "subscription_error");
  }
}

export function handleStripeError(
  error: Stripe.StripeRawError,
): StripeException {
  const { type, message, code, decline_code, param } = error;

  switch (type) {
    case "card_error":
      return new StripeCardException(
        message || "Your card was declined.",
        code,
        decline_code,
        param,
      );

    case "invalid_request_error":
      return new StripeInvalidRequestException(
        message || "Invalid request parameters.",
        param,
      );

    case "authentication_error":
      return new StripeAuthenticationException(
        message || "Authentication with Stripe's API failed.",
      );

    case "api_error":
      return new StripeApiException(
        message || "An error occurred with Stripe's API.",
      );

    case "idempotency_error":
      return new StripeIdempotencyException(
        message || "Idempotency key already used.",
      );

    default:
      return new StripeApiException(
        message || "An unexpected error occurred with Stripe.",
      );
  }
}

export function createStripeErrorResponse(error: StripeException): {
  success: boolean;
  error: {
    message: string;
    code: string;
    details: {
      param?: string;
      declineCode?: string;
      statusCode: number;
    };
  };
} {
  return {
    success: false,
    error: {
      message: error.message,
      code: error.stripeCode || "STRIPE_ERROR",
      details: {
        param: error.param,
        declineCode: error.declineCode,
        statusCode: error.statusCode,
      },
    },
  };
}
