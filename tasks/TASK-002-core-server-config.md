# TASK-002: Core Server Configuration and Middleware Setup

## Epic
Foundation Setup

## Story Points
3

## Priority
High

## Description
Configure the Express server with routing-controllers, set up essential middleware, and create the basic server bootstrap with TypeDI integration.

## Acceptance Criteria

### ✅ Server Bootstrap
- [ ] Create `src/server.ts` with routing-controllers setup
- [ ] Import `reflect-metadata` at the top
- [ ] Configure `useContainer(Container)` for TypeDI integration
- [ ] Set up `createExpressServer` with proper options
- [ ] Configure controllers directory scanning
- [ ] Enable validation and class transformation

### ✅ Middleware Configuration
- [ ] Create `src/config/middleware.ts` for middleware setup
- [ ] Implement security middleware (helmet)
- [ ] Configure CORS with environment-based origins
- [ ] Set up rate limiting with configurable limits
- [ ] Add compression middleware
- [ ] Configure request logging with morgan
- [ ] Set up body parsing middleware

### ✅ Application Configuration
- [ ] Create `src/config/app.ts` for app configuration
- [ ] Set up environment variable validation
- [ ] Configure server port and environment detection
- [ ] Create configuration objects for different environments
- [ ] Implement configuration validation

### ✅ Error Handling
- [ ] Create `src/middlewares/error.middleware.ts`
- [ ] Implement global error handler
- [ ] Set up structured error responses
- [ ] Configure error logging
- [ ] Handle different error types (validation, auth, database)

## Technical Requirements

### Server.ts Structure
```typescript
// CRITICAL: reflect-metadata must be imported FIRST
import "reflect-metadata";
import { createExpressServer, useContainer } from "routing-controllers";
import { Container } from "typedi";
import { config } from "./config/app";
import { setupMiddlewares } from "./config/middleware";

// Configure TypeDI container integration BEFORE importing any controllers
useContainer(Container);

const app = createExpressServer({
  // Use glob patterns to auto-discover controllers and middlewares
  controllers: [__dirname + "/controllers/**/*.js"],
  middlewares: [__dirname + "/middlewares/**/*.js"],
  
  // Enable validation with class-validator
  validation: true,
  
  // Enable automatic JSON transformation with class-transformer
  classTransformer: true,
  
  // Disable default error handler to use custom error handling
  defaultErrorHandler: false,
  
  // Set global API prefix
  routePrefix: "/api",
  
  // Enable CORS (can be configured with specific options)
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
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
setupMiddlewares(app);

app.listen(config.server.port, () => {
  console.log(`🚀 Server running on port ${config.server.port}`);
});
```

### Critical Setup Order
1. Import `reflect-metadata` FIRST
2. Configure `useContainer(Container)` BEFORE importing controllers
3. Use glob patterns for automatic component discovery
4. Configure validation and transformation options
5. Set up custom error handling

### Middleware Order
1. Security headers (helmet)
2. CORS configuration
3. Rate limiting
4. Compression
5. Request logging
6. Body parsing
7. Custom middleware
8. Error handling (last)

### Configuration Structure
```typescript
export const config = {
  server: {
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development'
  },
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
  }
};
```

## Definition of Done
- [ ] Server starts successfully on configured port
- [ ] All middleware properly configured and functional
- [ ] CORS works with environment-based origins
- [ ] Rate limiting responds correctly to excessive requests
- [ ] Error handling returns structured responses
- [ ] Configuration loads from environment variables
- [ ] Request logging shows in console during development
- [ ] Security headers present in responses

## Testing Strategy
- [ ] Start server and verify it responds on correct port
- [ ] Test CORS with different origins
- [ ] Verify rate limiting with rapid requests
- [ ] Test error handling with invalid requests
- [ ] Verify middleware execution order
- [ ] Check security headers in response

## Dependencies
- TASK-001: Project Setup and Initial Configuration

## Notes
- Keep middleware order consistent for predictable behavior
- Ensure error handling is comprehensive but not verbose
- Test rate limiting carefully to avoid blocking development