# TASK-017: Stripe Controller and API Endpoints

## Overview

Implement comprehensive REST API endpoints for Stripe payment processing, customer management, and subscription operations with proper authentication, validation, and error handling.

## Epic

**Payment Processing Infrastructure**

## Priority

High

## Story Points

10

## Description

Create a complete set of REST API endpoints that expose Stripe functionality through secure, well-documented controllers. This includes payment processing, customer management, subscription operations, and webhook handling with proper authentication and authorization.

## Acceptance Criteria

### 1. Payment Controller Implementation

- [ ] Create `src/controllers/stripe-payment.controller.ts` with payment operations
- [ ] Implement payment intent creation endpoint
- [ ] Add payment confirmation endpoint
- [ ] Create payment capture endpoint
- [ ] Add refund processing endpoint
- [ ] Implement payment history retrieval

### 2. Customer Controller Implementation

- [ ] Create `src/controllers/stripe-customer.controller.ts` with customer operations
- [ ] Implement customer creation endpoint
- [ ] Add customer update endpoint
- [ ] Create customer retrieval endpoint
- [ ] Add customer deletion endpoint
- [ ] Implement customer payment methods management

### 3. Subscription Controller Implementation

- [ ] Create `src/controllers/stripe-subscription.controller.ts` with subscription operations
- [ ] Implement subscription creation endpoint
- [ ] Add subscription update and plan change endpoints
- [ ] Create subscription cancellation endpoint
- [ ] Add subscription pause/resume endpoints
- [ ] Implement subscription billing preview

### 4. Product and Price Controller

- [ ] Create `src/controllers/stripe-product.controller.ts` for product management
- [ ] Implement product CRUD operations
- [ ] Add price management endpoints
- [ ] Create pricing plans listing endpoint
- [ ] Add product archiving functionality

### 5. Webhook Controller Integration

- [ ] Integrate webhook controller with existing webhook service
- [ ] Add webhook event processing endpoint
- [ ] Implement webhook signature verification
- [ ] Add webhook event logging
- [ ] Create webhook status monitoring endpoints

## Technical Requirements

### Payment Controller

```typescript
@Controller('/api/payments')
@UseGuards(AuthGuard)
export class StripePaymentController {
  @Post('/payment-intent')
  async createPaymentIntent(@Body() dto: ICreatePaymentIntentDto): Promise<IApiResponse<Stripe.PaymentIntent>>

  @Post('/payment-intent/:id/confirm')
  async confirmPaymentIntent(@Param('id') id: string, @Body() dto: IConfirmPaymentDto): Promise<IApiResponse<Stripe.PaymentIntent>>

  @Post('/payment-intent/:id/capture')
  async capturePaymentIntent(@Param('id') id: string, @Body() dto: ICapturePaymentDto): Promise<IApiResponse<Stripe.PaymentIntent>>

  @Post('/payment-intent/:id/refund')
  async refundPayment(@Param('id') id: string, @Body() dto: IRefundDto): Promise<IApiResponse<Stripe.Refund>>

  @Get('/payment-intent/:id')
  async getPaymentIntent(@Param('id') id: string): Promise<IApiResponse<Stripe.PaymentIntent>>

  @Get('/history')
  async getPaymentHistory(@Query() query: IPaymentHistoryQuery): Promise<IApiResponse<IPayment[]>>
}
```

### Customer Controller

```typescript
@Controller('/api/customers')
@UseGuards(AuthGuard)
export class StripeCustomerController {
  @Post('/')
  async createCustomer(@Body() dto: ICreateCustomerDto): Promise<IApiResponse<Stripe.Customer>>

  @Put('/:id')
  async updateCustomer(@Param('id') id: string, @Body() dto: IUpdateCustomerDto): Promise<IApiResponse<Stripe.Customer>>

  @Get('/:id')
  async getCustomer(@Param('id') id: string): Promise<IApiResponse<Stripe.Customer>>

  @Delete('/:id')
  async deleteCustomer(@Param('id') id: string): Promise<IApiResponse<{ deleted: boolean }>>

  @Get('/:id/payment-methods')
  async getCustomerPaymentMethods(@Param('id') id: string): Promise<IApiResponse<Stripe.PaymentMethod[]>>

  @Post('/:id/payment-methods')
  async attachPaymentMethod(@Param('id') id: string, @Body() dto: IAttachPaymentMethodDto): Promise<IApiResponse<Stripe.PaymentMethod>>
}
```

### Subscription Controller

```typescript
@Controller('/api/subscriptions')
@UseGuards(AuthGuard)
export class StripeSubscriptionController {
  @Post('/')
  async createSubscription(@Body() dto: ICreateSubscriptionDto): Promise<IApiResponse<Stripe.Subscription>>

  @Put('/:id')
  async updateSubscription(@Param('id') id: string, @Body() dto: IUpdateSubscriptionDto): Promise<IApiResponse<Stripe.Subscription>>

  @Delete('/:id')
  async cancelSubscription(@Param('id') id: string, @Body() dto: ICancelSubscriptionDto): Promise<IApiResponse<Stripe.Subscription>>

  @Post('/:id/pause')
  async pauseSubscription(@Param('id') id: string): Promise<IApiResponse<Stripe.Subscription>>

  @Post('/:id/resume')
  async resumeSubscription(@Param('id') id: string): Promise<IApiResponse<Stripe.Subscription>>

  @Get('/:id/upcoming-invoice')
  async getUpcomingInvoice(@Param('id') id: string): Promise<IApiResponse<Stripe.Invoice>>

  @Get('/')
  async getSubscriptions(@Query() query: ISubscriptionQuery): Promise<IApiResponse<Stripe.Subscription[]>>
}
```

### Product Controller

```typescript
@Controller('/api/products')
export class StripeProductController {
  @Get('/')
  async listProducts(): Promise<IApiResponse<Stripe.Product[]>>

  @Get('/:id')
  async getProduct(@Param('id') id: string): Promise<IApiResponse<Stripe.Product>>

  @Get('/:id/prices')
  async getProductPrices(@Param('id') id: string): Promise<IApiResponse<Stripe.Price[]>>

  @Post('/')
  @UseGuards(AuthGuard, RoleGuard(['admin']))
  async createProduct(@Body() dto: ICreateProductDto): Promise<IApiResponse<Stripe.Product>>

  @Put('/:id')
  @UseGuards(AuthGuard, RoleGuard(['admin']))
  async updateProduct(@Param('id') id: string, @Body() dto: IUpdateProductDto): Promise<IApiResponse<Stripe.Product>>
}
```

## Implementation Notes

1. **Authentication**: Use existing authentication middleware for protected endpoints
2. **Authorization**: Implement proper role-based access control
3. **Validation**: Use class-validator for request validation
4. **Error Handling**: Implement proper error handling with meaningful error messages
5. **Rate Limiting**: Apply rate limiting to prevent abuse
6. **Logging**: Add comprehensive logging for all operations
7. **Documentation**: Use OpenAPI/Swagger decorators for API documentation

## Testing Requirements

### Unit Tests

- [ ] Test all controller endpoints with valid payloads
- [ ] Test authentication and authorization
- [ ] Test input validation
- [ ] Test error handling scenarios
- [ ] Test rate limiting functionality
- [ ] Test webhook endpoint security

### Integration Tests

- [ ] Test complete payment flow through API
- [ ] Test customer management operations
- [ ] Test subscription lifecycle through API
- [ ] Test webhook processing
- [ ] Test error scenarios and recovery
- [ ] Test API rate limiting

## Definition of Done

- [ ] All acceptance criteria completed
- [ ] Unit tests written and passing (>80% coverage)
- [ ] Integration tests passing
- [ ] Code reviewed and approved
- [ ] API documentation updated
- [ ] Postman/OpenAPI collection created
- [ ] Authentication and authorization implemented
- [ ] Rate limiting configured
- [ ] Error handling implemented
- [ ] Logging added

## Dependencies

- **Requires**: TASK-012 (Stripe Setup), TASK-013 (Customer Management), TASK-014 (Payment Processing), TASK-015 (Webhook Handling), TASK-016 (Subscription Management)
- **Blocks**: None (Final implementation task)

## Estimated Duration

4-5 days

## Risk Assessment

**Medium Risk**

- API security requirements
- Complex validation requirements
- Multiple service integrations
- Error handling complexity

## API Documentation

### Response Format

```typescript
export interface IApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}
```

### Error Handling

```typescript
export class StripeErrorHandler {
  static handleStripeError(error: Stripe.StripeError): IApiResponse<never> {
    switch (error.type) {
      case "card_error":
        return {
          success: false,
          error: {
            message: "Payment failed. Please check your card details.",
            code: "PAYMENT_FAILED",
            details: error.message,
          },
        };
      case "invalid_request_error":
        return {
          success: false,
          error: {
            message: "Invalid request parameters.",
            code: "INVALID_REQUEST",
            details: error.message,
          },
        };
      default:
        return {
          success: false,
          error: {
            message: "An unexpected error occurred.",
            code: "INTERNAL_ERROR",
          },
        };
    }
  }
}
```

## Security Considerations

- [ ] Implement proper authentication for all endpoints
- [ ] Add role-based authorization where needed
- [ ] Validate all input parameters
- [ ] Implement rate limiting to prevent abuse
- [ ] Add CORS configuration for frontend integration
- [ ] Implement proper error messages that don't leak sensitive information
- [ ] Add audit logging for sensitive operations

## API Rate Limiting

```typescript
// Payment endpoints: 10 requests per minute
@RateLimit(10, 60000)

// Customer endpoints: 20 requests per minute
@RateLimit(20, 60000)

// Subscription endpoints: 5 requests per minute
@RateLimit(5, 60000)

// Webhook endpoints: 100 requests per minute
@RateLimit(100, 60000)
```

## Middleware Configuration

```typescript
// Add to app.ts for webhook raw body parsing
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));

// Standard JSON parsing for other endpoints
app.use(express.json());
```

## OpenAPI Documentation

- [ ] Add Swagger decorators to all controllers
- [ ] Document request/response schemas
- [ ] Add authentication requirements
- [ ] Include example requests and responses
- [ ] Document error responses
- [ ] Add rate limiting information

## Postman Collection

- [ ] Create comprehensive Postman collection
- [ ] Include all endpoints with example requests
- [ ] Add environment variables for different environments
- [ ] Include authentication setup
- [ ] Add webhook testing examples

## Notes

- Implement proper API versioning strategy
- Consider implementing API key authentication for machine-to-machine access
- Plan for API deprecation and migration strategies
- Implement proper CORS configuration for frontend integration
- Consider implementing API usage analytics
- Plan for API documentation hosting and maintenance
