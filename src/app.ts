// CRITICAL: reflect-metadata must be imported FIRST
import "reflect-metadata";

import express from "express";
import { useContainer, useExpressServer } from "routing-controllers";
import { Container } from "typedi";
import { config } from "./config/env";
import { AuthController } from "./controllers/auth.controller";
import { CacheDemoController } from "./controllers/cache-demo.controller";
import { HealthController } from "./controllers/health.controller";
import { StripeController } from "./controllers/stripe.controller";
import { TestAuthController } from "./controllers/test-auth.controller";
import { TestController } from "./controllers/test.controller";
import { UserController } from "./controllers/user.controller";
import { CacheInterceptor } from "./interceptors/cache.interceptor";
import { CompressionMiddleware } from "./middlewares/compression.middleware";
import { GlobalErrorHandler } from "./middlewares/error.middleware";
import { JSONParserMiddleware } from "./middlewares/json-parser.middleware";
import { MorganMiddleware } from "./middlewares/morgan.middleware";
import { RequestLoggerMiddleware } from "./middlewares/request-logger.middleware";
import { SecurityMiddleware } from "./middlewares/security.middleware";

// Only initialize Supabase if it's the configured database provider
if (config.database.provider === "supabase") {
  import("./config/supabase");
}

// Configure TypeDI container integration BEFORE importing any controllers
useContainer(Container);

// Create Express app manually to configure custom body parsing
export const app = express();

// Apply middleware based on environment configuration
// Skip middleware during tests to avoid conflicts
const isTestEnvironment = config.server.environment === "test";

if (!isTestEnvironment) {
  // 1. Compression (first, to compress all responses)
  if (config.middleware.enableCompression) {
    app.use(CompressionMiddleware.create());
    app.use(CompressionMiddleware.log());
  }

  // 2. Security headers (before any route processing)
  if (config.middleware.enableSecurity) {
    app.use(SecurityMiddleware.create());
    app.use(SecurityMiddleware.apiHeaders());
    app.use(SecurityMiddleware.validateHeaders());
    app.use(SecurityMiddleware.webhookHeaders());
  }

  // 3. Auto-correct JSON syntax issues (handles trailing commas automatically)
  app.use(JSONParserMiddleware.createAutoCorrector());

  // 4. HTTP access logging (after security and JSON parsing, before routes)
  if (config.middleware.enableMorganLogging) {
    app.use(MorganMiddleware.create());
    app.use(MorganMiddleware.webhookLogger());
    app.use(MorganMiddleware.errorLogger());
  }
}

// Application-specific middleware (always needed)
app.use(RequestLoggerMiddleware.create());

// Configure routing-controllers to use our Express app
useExpressServer(app, {
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

// Add JSON parsing error handler
app.use(JSONParserMiddleware.createErrorHandler());

// CRITICAL: Add the error handler as the last middleware to catch all errors
// This ensures JSON responses for all errors, including validation errors
app.use(GlobalErrorHandler.handle);
