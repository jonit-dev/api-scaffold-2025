// CRITICAL: reflect-metadata must be imported FIRST
import "reflect-metadata";
import { createExpressServer, useContainer } from "routing-controllers";
import { Container } from "typedi";
import { config } from "./config/app";
import { setupMiddlewares } from "./config/middleware";
import { GlobalErrorHandler } from "./middlewares/error.middleware";
import "./config/supabase";

// Configure TypeDI container integration BEFORE importing any controllers
useContainer(Container);

const app = createExpressServer({
  // Use glob patterns to auto-discover controllers and middlewares
  controllers: [__dirname + "/controllers/**/*.ts"],
  middlewares: [__dirname + "/middlewares/**/*.ts"],
  
  // Enable validation with class-validator
  validation: true,
  
  // Enable automatic JSON transformation with class-transformer
  classTransformer: true,
  
  // Disable default error handler to use custom error handling
  defaultErrorHandler: false,
  
  
  // Enable CORS (can be configured with specific options)
  cors: {
    origin: config.cors.origin,
    credentials: config.cors.credentials
  },
  
  // Configure global defaults
  defaults: {
    nullResultCode: 404,
    undefinedResultCode: 204,
    paramOptions: {
      required: true
    }
  }
});

// Apply additional middleware after routing-controllers setup
// setupMiddlewares(app);

// Apply global error handler as the last middleware
app.use(GlobalErrorHandler.handle);

app.listen(config.server.port, () => {
  console.log(`🚀 Server running on port ${config.server.port}`);
  console.log(`📋 Environment: ${config.server.environment}`);
  console.log(`🏥 Health check: http://localhost:${config.server.port}/health`);
});

export default app;