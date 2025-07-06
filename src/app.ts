// CRITICAL: reflect-metadata must be imported FIRST
import "reflect-metadata";

import { createExpressServer, useContainer } from "routing-controllers";
import { Container } from "typedi";
import { config } from "./config/env";
import "./config/supabase";
import { HealthController } from "./controllers/health.controller";
import { TestController } from "./controllers/test.controller";
import { AuthController } from "./controllers/auth.controller";
import { TestAuthController } from "./controllers/test-auth.controller";
import { CacheDemoController } from "./controllers/cache-demo.controller";
import { UserController } from "./controllers/user.controller";
import { StripeController } from "./controllers/stripe.controller";
import { GlobalErrorHandler } from "./middlewares/error.middleware";
import { RequestLoggerMiddleware } from "./middlewares/request-logger.middleware";
import { CacheInterceptor } from "./interceptors/cache.interceptor";
import { CompressionMiddleware } from "./middlewares/compression.middleware";
import { SecurityMiddleware } from "./middlewares/security.middleware";
import { MorganMiddleware } from "./middlewares/morgan.middleware";

// Configure TypeDI container integration BEFORE importing any controllers
useContainer(Container);

export const app = createExpressServer({
  // Import controllers explicitly to avoid glob pattern issues
  controllers: [
    HealthController,
    TestController,
    AuthController,
    TestAuthController,
    CacheDemoController,
    UserController,
    StripeController,
  ],
  middlewares: [GlobalErrorHandler],
  interceptors: [CacheInterceptor],

  // Set global route prefix
  routePrefix: "",

  // Enable validation with class-validator
  validation: true,

  // Enable automatic JSON transformation with class-transformer
  classTransformer: true,

  // Disable default error handler to use custom error handling
  defaultErrorHandler: false,

  // Enable built-in CORS (simpler than custom middleware)
  cors: {
    origin: config.cors.origin,
    credentials: config.cors.credentials,
  },

  // Configure global defaults
  defaults: {
    nullResultCode: 404,
    undefinedResultCode: 204,
    paramOptions: {
      required: true,
    },
  },
});

// Apply middleware based on environment configuration
// Skip middleware during tests to avoid conflicts
const isTestEnvironment = config.server.environment === "test";

if (!isTestEnvironment) {
  // 1. Security headers (production/development only)
  if (config.middleware.enableSecurity) {
    app.use(SecurityMiddleware.create());
    app.use(SecurityMiddleware.apiHeaders());
    app.use(SecurityMiddleware.validateHeaders());
    app.use(SecurityMiddleware.webhookHeaders());
  }

  // 2. HTTP access logging (production/development only)
  if (config.middleware.enableMorganLogging) {
    app.use(MorganMiddleware.create());
    app.use(MorganMiddleware.webhookLogger());
    app.use(MorganMiddleware.errorLogger());
  }

  // 3. Compression (production/development only)
  if (config.middleware.enableCompression) {
    app.use(CompressionMiddleware.create());
    app.use(CompressionMiddleware.log());
  }
}

// Application-specific middleware (always needed)
app.use(RequestLoggerMiddleware.create());

// Global error handler (must be last)
app.use(GlobalErrorHandler.handle);
