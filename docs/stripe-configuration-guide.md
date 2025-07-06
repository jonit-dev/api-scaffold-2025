# Stripe Configuration Guide

## Overview

This guide covers the complete configuration setup for Stripe integration in the API scaffold, including environment variables, database setup, webhook configuration, and deployment considerations.

## Environment Configuration

### Development Environment

Create a `.env` file in your project root with the following Stripe configuration:

```env
# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_51234567890abcdef...
STRIPE_SECRET_KEY=sk_test_51234567890abcdef...
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef...
STRIPE_API_VERSION=2023-10-16

# Payment Configuration
DEFAULT_CURRENCY=usd
MAX_PAYMENT_AMOUNT=100000
MIN_PAYMENT_AMOUNT=50
AUTO_CAPTURE_PAYMENTS=true

# Subscription Configuration
DEFAULT_TRIAL_DAYS=14
ALLOW_MULTIPLE_SUBSCRIPTIONS=false
PRORATION_BEHAVIOR=create_prorations
GRACE_PERIOD_DAYS=3
MAX_RETRY_ATTEMPTS=3

# Webhook Configuration
WEBHOOK_MAX_RETRIES=3
WEBHOOK_RETRY_DELAY=1000
```

### Production Environment

For production, use live Stripe keys:

```env
# Stripe Configuration (Production)
STRIPE_PUBLISHABLE_KEY=pk_live_51234567890abcdef...
STRIPE_SECRET_KEY=sk_live_51234567890abcdef...
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef...
STRIPE_API_VERSION=2023-10-16

# Security
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
WEBHOOK_IP_WHITELIST=3.18.12.63,3.130.192.231,13.235.14.237,13.235.122.149
```

## Application Configuration

### Environment Config Integration

Update `src/config/env.ts` to include Stripe configuration:

```typescript
import dotenv from "dotenv";

dotenv.config();

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value;
}

export const config = {
  // ... existing config

  stripe: {
    publishableKey: getEnvVar("STRIPE_PUBLISHABLE_KEY", "pk_test_default"),
    secretKey: getEnvVar("STRIPE_SECRET_KEY", "sk_test_default"),
    webhookSecret: getEnvVar("STRIPE_WEBHOOK_SECRET", "whsec_default"),
    apiVersion: (process.env.STRIPE_API_VERSION ||
      "2023-10-16") as Stripe.LatestApiVersion,
  },

  payment: {
    defaultCurrency: process.env.DEFAULT_CURRENCY || "usd",
    maxPaymentAmount: parseInt(process.env.MAX_PAYMENT_AMOUNT || "100000", 10),
    minPaymentAmount: parseInt(process.env.MIN_PAYMENT_AMOUNT || "50", 10),
    autoCapture: process.env.AUTO_CAPTURE_PAYMENTS === "true",
  },

  subscription: {
    defaultTrialDays: parseInt(process.env.DEFAULT_TRIAL_DAYS || "14", 10),
    allowMultipleSubscriptions:
      process.env.ALLOW_MULTIPLE_SUBSCRIPTIONS === "true",
    prorationBehavior: process.env.PRORATION_BEHAVIOR || "create_prorations",
    gracePeriodDays: parseInt(process.env.GRACE_PERIOD_DAYS || "3", 10),
    maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || "3", 10),
  },

  webhook: {
    maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || "3", 10),
    retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY || "1000", 10),
  },
};

// Stripe-specific environment validation
const stripeRequiredEnvVars = [
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

const missingStripeEnvVars = stripeRequiredEnvVars.filter(
  (envVar) => !process.env[envVar],
);

if (missingStripeEnvVars.length > 0 && process.env.NODE_ENV !== "test") {
  console.error(
    `❌ Missing required Stripe environment variables: ${missingStripeEnvVars.join(", ")}`,
  );
  process.exit(1);
}
```

## Database Configuration

### Database Migrations

Create the following database migrations to support Stripe integration:

#### 1. User Table Extension

```sql
-- Add Stripe customer ID to users table
ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255) UNIQUE;
CREATE INDEX idx_users_stripe_customer_id ON users(stripe_customer_id);
```

#### 2. Payments Table

```sql
-- Create payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'usd',
  status VARCHAR(50) NOT NULL,
  payment_method VARCHAR(255),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_stripe_customer_id ON payments(stripe_customer_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);
```

#### 3. Subscriptions Table

```sql
-- Create subscriptions table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

-- Create indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_current_period_end ON subscriptions(current_period_end);
```

#### 4. Webhook Events Table

```sql
-- Create webhook events table
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE,
  payload JSONB NOT NULL,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_webhook_events_stripe_event_id ON webhook_events(stripe_event_id);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_retry_count ON webhook_events(retry_count);
```

#### 5. Subscription History Table

```sql
-- Create subscription history table for audit trail
CREATE TABLE subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  performed_by UUID REFERENCES users(id),
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_subscription_history_subscription_id ON subscription_history(subscription_id);
CREATE INDEX idx_subscription_history_performed_at ON subscription_history(performed_at);
```

## Stripe Dashboard Configuration

### 1. API Keys Setup

1. **Login to Stripe Dashboard**
   - Go to [https://dashboard.stripe.com](https://dashboard.stripe.com)
   - Sign in to your account

2. **Get Test Keys**
   - Navigate to **Developers** → **API Keys**
   - Copy the **Publishable key** (starts with `pk_test_`)
   - Copy the **Secret key** (starts with `sk_test_`)

3. **Get Live Keys (Production)**
   - Toggle to **Live mode** in the dashboard
   - Copy the **Publishable key** (starts with `pk_live_`)
   - Copy the **Secret key** (starts with `sk_live_`)

### 2. Webhook Configuration

1. **Create Webhook Endpoint**
   - Go to **Developers** → **Webhooks**
   - Click **Add endpoint**
   - Enter your endpoint URL: `https://yourdomain.com/api/webhooks/stripe`
   - Select events to send:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `customer.created`
     - `customer.updated`
     - `customer.deleted`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

2. **Get Webhook Secret**
   - Click on your webhook endpoint
   - Copy the **Signing secret** (starts with `whsec_`)

### 3. Product and Price Setup

1. **Create Products**
   - Go to **Products** → **Add product**
   - Enter product details:
     - Name: "Basic Plan"
     - Description: "Basic subscription plan"
     - Pricing: Recurring, Monthly, $10.00

2. **Create Multiple Prices**
   - Add different pricing tiers
   - Set up annual pricing with discounts
   - Configure usage-based pricing if needed

### 4. Tax Configuration

1. **Tax Settings**
   - Go to **Settings** → **Tax**
   - Enable automatic tax collection
   - Configure tax rates for your jurisdictions

## Application Middleware Setup

### 1. Webhook Middleware

```typescript
// src/app.ts
import express from "express";
import { webhookRouter } from "./routes/webhook";

const app = express();

// Raw body middleware for webhooks (MUST be before JSON middleware)
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));

// JSON middleware for other routes
app.use(express.json());

// Webhook routes
app.use("/api/webhooks", webhookRouter);
```

### 2. CORS Configuration

```typescript
// src/config/cors.ts
import { CorsOptions } from "cors";

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      "http://localhost:3000",
      "https://yourdomain.com",
      "https://js.stripe.com", // For Stripe.js
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "stripe-signature"],
};
```

### 3. Rate Limiting

```typescript
// src/middleware/rate-limit.ts
import rateLimit from "express-rate-limit";

// Payment endpoints rate limiting
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: "Too many payment requests from this IP, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Webhook endpoints rate limiting
export const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many webhook requests from this IP",
  standardHeaders: true,
  legacyHeaders: false,
});
```

## Security Configuration

### 1. Environment Variables Security

```bash
# Use environment variable management tools
# For production, use tools like:
# - AWS Secrets Manager
# - Azure Key Vault
# - Google Secret Manager
# - HashiCorp Vault

# Example using AWS Secrets Manager
export STRIPE_SECRET_KEY=$(aws secretsmanager get-secret-value \
  --secret-id stripe-secret-key \
  --query SecretString \
  --output text)
```

### 2. IP Whitelisting

```typescript
// src/middleware/ip-whitelist.ts
import { Request, Response, NextFunction } from "express";

const stripeIPs = [
  "3.18.12.63",
  "3.130.192.231",
  "13.235.14.237",
  "13.235.122.149",
  "18.211.135.69",
  "3.89.36.69",
  "54.187.174.169",
  "54.187.205.235",
  "54.187.216.72",
  "54.241.31.99",
  "54.241.31.102",
  "54.241.34.107",
];

export const whitelistStripeIPs = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const clientIP = req.ip || req.connection.remoteAddress;

  if (process.env.NODE_ENV !== "production") {
    return next(); // Skip IP check in development
  }

  if (stripeIPs.includes(clientIP)) {
    next();
  } else {
    console.warn(`Blocked request from IP: ${clientIP}`);
    res.status(403).json({ error: "Forbidden" });
  }
};
```

## Testing Configuration

### Test Environment Setup

```env
# Test environment variables
NODE_ENV=test
STRIPE_PUBLISHABLE_KEY=pk_test_51234567890abcdef...
STRIPE_SECRET_KEY=sk_test_51234567890abcdef...
STRIPE_WEBHOOK_SECRET=whsec_test_1234567890abcdef...

# Test database
DATABASE_URL=postgresql://user:pass@localhost:5432/test_db
```

### Test Configuration

```typescript
// src/config/test.ts
export const testConfig = {
  stripe: {
    publishableKey: "pk_test_51234567890abcdef...",
    secretKey: "sk_test_51234567890abcdef...",
    webhookSecret: "whsec_test_1234567890abcdef...",
  },
  testCards: {
    visa: "4242424242424242",
    visaDebit: "4000056655665556",
    mastercard: "5555555555554444",
    amex: "378282246310005",
    declined: "4000000000000002",
    insufficientFunds: "4000000000009995",
  },
  testCustomers: {
    default: {
      email: "test@example.com",
      name: "Test Customer",
    },
  },
};
```

## Deployment Configuration

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN yarn build

# Expose port
EXPOSE 3000

# Start application
CMD ["yarn", "start"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: "3.8"

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@db:5432/apidb
      - STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=apidb
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### CI/CD Configuration

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"
          cache: "yarn"

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Run tests
        run: yarn test
        env:
          NODE_ENV: test
          STRIPE_PUBLISHABLE_KEY: ${{ secrets.STRIPE_TEST_PUBLISHABLE_KEY }}
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
          STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_TEST_WEBHOOK_SECRET }}

      - name: Deploy to production
        run: |
          # Your deployment commands here
          echo "Deploying to production..."
```

## Environment-Specific Configurations

### Development

```typescript
// src/config/development.ts
export const developmentConfig = {
  stripe: {
    logLevel: "debug",
    timeout: 30000,
    maxRetries: 3,
  },
  webhooks: {
    skipSignatureValidation: false, // Always validate even in dev
    logEvents: true,
  },
  payments: {
    requireConfirmation: true,
    autoCapture: false, // Manual capture for testing
  },
};
```

### Production

```typescript
// src/config/production.ts
export const productionConfig = {
  stripe: {
    logLevel: "info",
    timeout: 15000,
    maxRetries: 5,
  },
  webhooks: {
    skipSignatureValidation: false,
    logEvents: false,
    enableMetrics: true,
  },
  payments: {
    requireConfirmation: true,
    autoCapture: true,
  },
};
```

## Monitoring Configuration

### Application Metrics

```typescript
// src/config/metrics.ts
export const metricsConfig = {
  stripe: {
    trackPaymentMetrics: true,
    trackSubscriptionMetrics: true,
    trackWebhookMetrics: true,
  },
  dashboard: {
    enabled: true,
    endpoint: "/metrics",
    authentication: true,
  },
};
```

### Logging Configuration

```typescript
// src/config/logging.ts
export const loggingConfig = {
  level: process.env.LOG_LEVEL || "info",
  format: "json",
  transports: [
    {
      type: "console",
      level: "info",
    },
    {
      type: "file",
      filename: "stripe-operations.log",
      level: "debug",
    },
  ],
  stripe: {
    logPayments: true,
    logWebhooks: true,
    logCustomers: false, // Contains PII
    logSubscriptions: true,
  },
};
```

## Configuration Validation

### Startup Validation

```typescript
// src/config/validation.ts
export const validateConfiguration = (): void => {
  const errors: string[] = [];

  // Validate Stripe configuration
  if (!config.stripe.secretKey.startsWith("sk_")) {
    errors.push("Invalid Stripe secret key format");
  }

  if (!config.stripe.publishableKey.startsWith("pk_")) {
    errors.push("Invalid Stripe publishable key format");
  }

  if (!config.stripe.webhookSecret.startsWith("whsec_")) {
    errors.push("Invalid Stripe webhook secret format");
  }

  // Validate payment configuration
  if (config.payment.maxPaymentAmount <= config.payment.minPaymentAmount) {
    errors.push("Max payment amount must be greater than min payment amount");
  }

  // Validate subscription configuration
  if (config.subscription.defaultTrialDays < 0) {
    errors.push("Default trial days cannot be negative");
  }

  if (errors.length > 0) {
    console.error("Configuration validation failed:");
    errors.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }

  console.log("✅ Configuration validation passed");
};
```

## Troubleshooting Configuration

### Common Issues

1. **Webhook signature verification fails**
   - Check webhook secret configuration
   - Ensure raw body is used for verification
   - Verify webhook endpoint URL

2. **Payment processing fails**
   - Check API key permissions
   - Verify payment amount limits
   - Check currency configuration

3. **Database connection issues**
   - Verify database URL format
   - Check database user permissions
   - Ensure database exists

### Debug Configuration

```typescript
// src/config/debug.ts
export const debugConfig = {
  stripe: {
    logRequests: process.env.DEBUG_STRIPE_REQUESTS === "true",
    logResponses: process.env.DEBUG_STRIPE_RESPONSES === "true",
    logWebhooks: process.env.DEBUG_WEBHOOKS === "true",
  },
  database: {
    logQueries: process.env.DEBUG_DB_QUERIES === "true",
    logConnections: process.env.DEBUG_DB_CONNECTIONS === "true",
  },
};
```

## Related Documentation

- [Stripe Integration Guide](./stripe-integration.md)
- [Stripe API Reference](./stripe-api-reference.md)
- [Stripe Webhook Guide](./stripe-webhook-guide.md)
- [Stripe Testing Guide](./stripe-testing-guide.md)
- [Database Guide](./database-guide.md)
