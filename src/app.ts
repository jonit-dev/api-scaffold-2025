// CRITICAL: reflect-metadata must be imported FIRST
import "reflect-metadata";

import { createExpressServer, useContainer } from "routing-controllers";
import { Container } from "typedi";
import { config } from "./config/app";
import "./config/supabase";
import { HealthController } from "./controllers/health.controller";
import { TestController } from "./controllers/test.controller";
import { GlobalErrorHandler } from "./middlewares/error.middleware";

// Configure TypeDI container integration BEFORE importing any controllers
useContainer(Container);

export const app = createExpressServer({
  // Import controllers explicitly to avoid glob pattern issues
  controllers: [HealthController, TestController],
  middlewares: [GlobalErrorHandler],

  // Set global route prefix
  routePrefix: "",

  // Enable validation with class-validator
  validation: true,

  // Enable automatic JSON transformation with class-transformer
  classTransformer: true,

  // Disable default error handler to use custom error handling
  defaultErrorHandler: false,

  // Enable CORS (can be configured with specific options)
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

// Apply additional middleware after routing-controllers setup
// Note: setupMiddlewares can be imported and used here if needed

// Apply global error handler as the last middleware
app.use(GlobalErrorHandler.handle);
