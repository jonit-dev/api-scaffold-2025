# Rate Limiting System

## Overview

The rate limiting system provides robust protection against API abuse, brute force attacks, and resource exhaustion through a decorator-based approach built on multi-tier caching infrastructure. It implements sliding window rate limiting with Redis persistence and memory fallback for high availability.

## System Architecture

### High-Level Architecture

```mermaid
graph TB
    Client[Client Request]
    RateLimitMiddleware[Rate Limit Middleware]
    CacheService[Cache Service]

    subgraph "Cache Layer"
        MemoryCache[Memory Cache L1]
        RedisCache[Redis Cache L2]
    end

    subgraph "Storage"
        Redis[(Redis Server)]
        Memory[(In-Memory Store)]
    end

    Client --> RateLimitMiddleware
    RateLimitMiddleware --> CacheService
    CacheService --> MemoryCache
    CacheService --> RedisCache

    MemoryCache --> Memory
    RedisCache --> Redis

    subgraph "Rate Limit Components"
        RateLimitDecorator[Rate Limit Decorator]
        RateLimitConfig[Rate Limit Configuration]
        HeaderManager[HTTP Headers Manager]
        KeyGenerator[Key Generation]
    end

    RateLimitMiddleware --> RateLimitDecorator
    RateLimitMiddleware --> RateLimitConfig
    RateLimitMiddleware --> HeaderManager
    RateLimitMiddleware --> KeyGenerator
```

### Request Flow

```mermaid
sequenceDiagram
    participant Client
    participant Decorator as Rate Limit Decorator
    participant Middleware as Rate Limit Middleware
    participant Cache as Cache Service
    participant Redis as Redis Store
    participant Controller as Route Handler

    Client->>Decorator: HTTP Request
    Decorator->>Middleware: applyRateLimit()
    Middleware->>Cache: incrWithExpire(key, window)
    Cache->>Redis: INCR + EXPIRE pipeline
    Redis-->>Cache: Current count
    Cache-->>Middleware: Request count

    alt Within Rate Limit
        Middleware->>Middleware: Set rate limit headers
        Middleware->>Controller: Forward request
        Controller-->>Client: Response with headers
    else Rate Limit Exceeded
        Middleware->>Middleware: Generate 429 response
        Middleware-->>Client: 429 Too Many Requests
    end
```

## Core Components

### Rate Limit Middleware

```typescript
@Service()
export class RateLimitMiddleware {
  constructor(private cacheService: CacheService) {}

  async applyRateLimit(
    request: Request,
    response: Response,
    options: IRateLimitOptions,
  ): Promise<boolean> {
    const key = this.generateKey(request, options);
    const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    const maxRequests = options.maxRequests || 100;

    try {
      const currentCount = await this.cacheService.incrWithExpire(
        key,
        Math.ceil(windowMs / 1000),
      );

      this.setRateLimitHeaders(response, maxRequests, currentCount, windowMs);

      if (currentCount > maxRequests) {
        throw new TooManyRequestsException(
          `Rate limit exceeded. Try again in ${Math.ceil(windowMs / 1000)} seconds.`,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof TooManyRequestsException) {
        throw error;
      }

      // Graceful degradation - allow request if cache fails
      return true;
    }
  }
}
```

### Rate Limit Decorator

```typescript
export function RateLimit(options: IRateLimitOptions) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const req = args.find((arg) => arg && arg.method) as Request;
      const res = args.find((arg) => arg && arg.status) as Response;

      if (!req || !res) {
        throw new Error(
          "Request or Response object not found in method arguments",
        );
      }

      const rateLimitMiddleware = Container.get(RateLimitMiddleware);
      await rateLimitMiddleware.applyRateLimit(req, res, options);

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
```

### Rate Limit Configuration Interface

```typescript
interface IRateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: Request) => string; // Custom key generation
  skipSuccessfulRequests?: boolean; // Skip counting successful requests
  skipFailedRequests?: boolean; // Skip counting failed requests
  onLimitReached?: (req: Request, res: Response) => void; // Callback on limit exceeded
}
```

## Rate Limiting Strategies

### Sliding Window Implementation

```mermaid
graph TD
    Request[Incoming Request]
    GenerateKey[Generate Cache Key]
    IncrementCounter[Increment Counter]
    SetExpiration[Set Expiration]
    CheckLimit[Check Against Limit]

    Request --> GenerateKey
    GenerateKey --> IncrementCounter
    IncrementCounter --> SetExpiration
    SetExpiration --> CheckLimit

    CheckLimit --> |Within Limit| AllowRequest[Allow Request]
    CheckLimit --> |Over Limit| BlockRequest[Block Request]

    subgraph "Cache Operations"
        IncrementCounter --> |Redis Available| RedisIncr[Redis INCR]
        IncrementCounter --> |Redis Down| MemoryIncr[Memory Increment]
        SetExpiration --> |Redis Available| RedisExpire[Redis EXPIRE]
        SetExpiration --> |Redis Down| MemoryExpire[Memory TTL]
    end

    RedisIncr --> RedisExpire
    MemoryIncr --> MemoryExpire
```

### Key Generation Strategy

```mermaid
graph LR
    RequestInfo[Request Information]

    RequestInfo --> IPAddress[IP Address]
    RequestInfo --> Endpoint[Endpoint Path]
    RequestInfo --> Method[HTTP Method]
    RequestInfo --> UserID[User ID]

    IPAddress --> KeyGen[Key Generation]
    Endpoint --> KeyGen
    Method --> KeyGen
    UserID --> KeyGen

    KeyGen --> FinalKey[rate_limit:192.168.1.100:/api/auth/login]

    subgraph "Key Format"
        FinalKey --> Prefix[rate_limit:]
        FinalKey --> Identifier[IP/UserID]
        FinalKey --> Path[Endpoint Path]
    end
```

## Authentication Rate Limits

### Predefined Rate Limit Configurations

```typescript
export const authRateLimits = {
  register: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 registration attempts
  },
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // 10 login attempts
  },
  passwordReset: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 3, // 3 password reset requests
  },
  tokenRefresh: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 20, // 20 token refresh requests
  },
  emailVerification: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // 10 verification attempts
  },
  resendVerification: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 3, // 3 resend requests
  },
};
```

### Rate Limit Application Matrix

```mermaid
graph TD
    Endpoints[API Endpoints]

    Endpoints --> AuthEndpoints[Authentication Endpoints]
    Endpoints --> PublicEndpoints[Public Endpoints]
    Endpoints --> ProtectedEndpoints[Protected Endpoints]

    AuthEndpoints --> RegisterRL[Register: 5/15min]
    AuthEndpoints --> LoginRL[Login: 10/15min]
    AuthEndpoints --> PasswordResetRL[Password Reset: 3/15min]
    AuthEndpoints --> TokenRefreshRL[Token Refresh: 20/15min]
    AuthEndpoints --> EmailVerifyRL[Email Verify: 10/15min]
    AuthEndpoints --> ResendVerifyRL[Resend Verify: 3/15min]

    PublicEndpoints --> NoRateLimit[No Rate Limiting]
    ProtectedEndpoints --> AuthProtected[Auth-Protected Only]

    subgraph "Security Levels"
        High[High Security: 3-5 requests]
        Medium[Medium Security: 10-20 requests]
        Low[Low Security: No limit]
    end

    RegisterRL --> High
    PasswordResetRL --> High
    ResendVerifyRL --> High
    LoginRL --> Medium
    TokenRefreshRL --> Medium
    EmailVerifyRL --> Medium
```

## HTTP Headers

### Rate Limit Headers

```typescript
interface RateLimitHeaders {
  "X-RateLimit-Limit": number; // Maximum requests allowed
  "X-RateLimit-Remaining": number; // Requests remaining in window
  "X-RateLimit-Window": number; // Time window in milliseconds
  "X-RateLimit-Reset": number; // Reset time for blocked requests
}
```

### Header Implementation

```mermaid
sequenceDiagram
    participant Client
    participant Middleware as Rate Limit Middleware
    participant Cache as Cache Service
    participant Response as HTTP Response

    Client->>Middleware: HTTP Request
    Middleware->>Cache: Get current count
    Cache-->>Middleware: Current count
    Middleware->>Response: Set X-RateLimit-Limit
    Middleware->>Response: Set X-RateLimit-Remaining
    Middleware->>Response: Set X-RateLimit-Window
    Middleware->>Response: Set X-RateLimit-Reset
    Response-->>Client: Response with headers

    Note over Client: Client can implement backoff based on headers
```

### Header Values Example

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Window: 900000
X-RateLimit-Reset: 1640995200000
Content-Type: application/json
```

## Storage Architecture

### Cache Service Integration

```mermaid
graph TB
    RateLimitMiddleware[Rate Limit Middleware]
    CacheService[Cache Service]

    subgraph "Cache Layers"
        MemoryCache[Memory Cache]
        RedisCache[Redis Cache]
    end

    RateLimitMiddleware --> CacheService
    CacheService --> MemoryCache
    CacheService --> RedisCache

    subgraph "Operations"
        IncrWithExpire[incrWithExpire]
        Get[get]
        Set[set]
        Del[del]
    end

    CacheService --> IncrWithExpire
    CacheService --> Get
    CacheService --> Set
    CacheService --> Del

    subgraph "Storage Benefits"
        MemoryCache --> |~1ms| UltraFast[Ultra Fast Access]
        RedisCache --> |~5-10ms| FastPersistent[Fast + Persistent]
        RedisCache --> |Distributed| Scalable[Horizontally Scalable]
    end
```

### Atomic Operations

```typescript
async incrWithExpire(key: string, ttl: number): Promise<number> {
  try {
    if (this.redisClient) {
      // Redis pipeline for atomic operations
      const pipeline = this.redisClient.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, ttl);
      const results = await pipeline.exec();
      return results[0][1] as number;
    } else {
      // Memory fallback
      const current = await this.memoryCache.get(key) || 0;
      const newValue = current + 1;
      await this.memoryCache.set(key, newValue, ttl * 1000);
      return newValue;
    }
  } catch (error) {
    // Graceful degradation
    return 0;
  }
}
```

## Error Handling

### Rate Limit Exception

```typescript
export class TooManyRequestsException extends HttpException {
  constructor(message: string = "Too many requests") {
    super(message, 429);
    this.name = "TooManyRequestsException";
  }
}
```

### Error Response Format

```mermaid
graph TD
    RateLimitExceeded[Rate Limit Exceeded]
    ExceptionThrown[TooManyRequestsException]
    ErrorResponse[Error Response]

    RateLimitExceeded --> ExceptionThrown
    ExceptionThrown --> ErrorResponse

    ErrorResponse --> StatusCode[HTTP 429]
    ErrorResponse --> Headers[Rate Limit Headers]
    ErrorResponse --> Body[Error Message]

    subgraph "Response Structure"
        StatusCode --> Code429[429 Too Many Requests]
        Headers --> RateLimitHeaders[X-RateLimit-* Headers]
        Body --> Message[Error message with retry info]
    end
```

### Graceful Degradation

```mermaid
graph TD
    RateLimitCheck[Rate Limit Check]
    CacheAvailable{Cache Available?}

    CacheAvailable --> |Yes| NormalOperation[Normal Rate Limiting]
    CacheAvailable --> |No| GracefulDegradation[Allow Request Through]

    NormalOperation --> CheckLimit[Check Against Limit]
    GracefulDegradation --> LogError[Log Cache Error]
    GracefulDegradation --> ContinueRequest[Continue with Request]

    CheckLimit --> |Within Limit| AllowRequest[Allow Request]
    CheckLimit --> |Over Limit| BlockRequest[Block Request]

    LogError --> ContinueRequest

    subgraph "Degradation Strategy"
        GracefulDegradation --> FailOpen[Fail Open Strategy]
        FailOpen --> HighAvailability[Maintain High Availability]
        FailOpen --> SecurityTradeoff[Security vs Availability Trade-off]
    end
```

## Performance Optimization

### Caching Strategy

```mermaid
graph LR
    Request[Request]

    Request --> L1Check[L1 Cache Check]
    L1Check --> |Hit| L1Response[Memory Response ~1ms]
    L1Check --> |Miss| L2Check[L2 Cache Check]
    L2Check --> |Hit| L2Response[Redis Response ~5-10ms]
    L2Check --> |Miss| NewCounter[Initialize Counter]

    L2Response --> UpdateL1[Update L1 Cache]
    NewCounter --> UpdateL1

    subgraph "Performance Characteristics"
        L1Response --> UltraFast[Ultra Fast]
        L2Response --> Fast[Fast]
        UpdateL1 --> Cached[Cached for Next Request]
    end
```

### Memory Management

```typescript
interface CacheConfiguration {
  maxSize: number; // Maximum cache size
  ttl: number; // Default TTL in seconds
  checkPeriod: number; // Cleanup check period
  deleteOnExpire: boolean; // Auto-delete expired entries
}

const rateLimitCacheConfig: CacheConfiguration = {
  maxSize: 10000, // 10k entries
  ttl: 900, // 15 minutes
  checkPeriod: 600, // 10 minutes cleanup
  deleteOnExpire: true, // Auto-cleanup
};
```

## Integration Patterns

### Controller Integration

```typescript
@Controller("/api/auth")
export class AuthController {
  @Post("/register")
  @RateLimit(authRateLimits.register)
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    // Registration logic
  }

  @Post("/login")
  @RateLimit(authRateLimits.login)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    // Login logic
  }

  @Post("/refresh")
  @RateLimit(authRateLimits.tokenRefresh)
  async refreshToken(
    @Body() refreshDto: RefreshTokenDto,
  ): Promise<AuthResponseDto> {
    // Token refresh logic
  }
}
```

### Custom Key Generation

```typescript
const customKeyGenerator = (req: Request): string => {
  const userId = req.user?.id;
  const ip = req.ip;
  const endpoint = req.path;

  // Use user ID if authenticated, otherwise fall back to IP
  const identifier = userId || ip;
  return `rate_limit:${identifier}:${endpoint}`;
};

@RateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  keyGenerator: customKeyGenerator
})
async someProtectedEndpoint() {
  // Endpoint logic
}
```

## Configuration Management

### Environment Variables

```env
# Rate Limiting Configuration
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_KEY_PREFIX=rate_limit

# Cache Configuration (for rate limiting storage)
REDIS_URL=redis://localhost:6379
CACHE_PROVIDER=redis
CACHE_TTL=900

# Environment-specific overrides
RATE_LIMIT_ENABLED=false  # Disable in test environment
```

### Dynamic Configuration

```typescript
interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  gracefulDegradation: boolean;
}

const rateLimitConfig: RateLimitConfig = {
  enabled: process.env.RATE_LIMIT_ENABLED !== "false",
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"),
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
  keyPrefix: process.env.RATE_LIMIT_KEY_PREFIX || "rate_limit",
  gracefulDegradation: process.env.RATE_LIMIT_GRACEFUL_DEGRADATION !== "false",
};
```

## Security Features

### Brute Force Protection

```mermaid
graph TD
    LoginAttempt[Login Attempt]
    RateLimitCheck[Rate Limit Check]

    LoginAttempt --> RateLimitCheck
    RateLimitCheck --> |Within Limit| ProcessLogin[Process Login]
    RateLimitCheck --> |Over Limit| BlockLogin[Block Login]

    ProcessLogin --> |Success| ResetCounter[Reset Counter]
    ProcessLogin --> |Failure| IncrementCounter[Increment Counter]

    BlockLogin --> SecurityLog[Log Security Event]
    BlockLogin --> ReturnError[Return 429 Error]

    subgraph "Attack Mitigation"
        IncrementCounter --> |Multiple Failures| TriggerAlert[Trigger Security Alert]
        SecurityLog --> |Pattern Detection| AutoBlock[Automatic IP Blocking]
        ReturnError --> |Exponential Backoff| IncreaseDelay[Increase Delay]
    end
```

### IP-Based Identification

```typescript
function extractClientIdentifier(req: Request): string {
  // Priority order for client identification
  const forwarded = req.get("X-Forwarded-For");
  const realIp = req.get("X-Real-IP");
  const remoteIp = req.connection.remoteAddress;

  // Handle proxy scenarios
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  return remoteIp || "unknown";
}
```

## Monitoring and Observability

### Rate Limit Metrics

```mermaid
graph TD
    RateLimitMetrics[Rate Limit Metrics]

    RateLimitMetrics --> RequestVolume[Request Volume]
    RateLimitMetrics --> BlockedRequests[Blocked Requests]
    RateLimitMetrics --> CachePerformance[Cache Performance]
    RateLimitMetrics --> ErrorRates[Error Rates]

    RequestVolume --> |Per Endpoint| EndpointMetrics[Endpoint-specific Metrics]
    BlockedRequests --> |By IP| IPMetrics[IP-based Metrics]
    CachePerformance --> |Hit Rate| CacheHitRate[Cache Hit Rate]
    ErrorRates --> |Cache Failures| CacheErrorRate[Cache Error Rate]

    subgraph "Monitoring Dashboard"
        EndpointMetrics --> |High Traffic| TrafficAlert[Traffic Alert]
        IPMetrics --> |Suspicious Activity| SecurityAlert[Security Alert]
        CacheHitRate --> |Low Hit Rate| CacheAlert[Cache Performance Alert]
        CacheErrorRate --> |High Error Rate| SystemAlert[System Health Alert]
    end
```

### Health Check Integration

```typescript
export class RateLimitHealthCheck {
  constructor(
    private cacheService: CacheService,
    private rateLimitMiddleware: RateLimitMiddleware,
  ) {}

  async checkHealth(): Promise<HealthStatus> {
    try {
      // Test cache connectivity
      const testKey = "health_check_rate_limit";
      await this.cacheService.set(testKey, "test", 5);
      const value = await this.cacheService.get(testKey);

      if (value !== "test") {
        throw new Error("Cache read/write test failed");
      }

      // Test rate limit functionality
      const mockRequest = { ip: "127.0.0.1", path: "/health" } as Request;
      const mockResponse = { set: jest.fn() } as any;

      await this.rateLimitMiddleware.applyRateLimit(mockRequest, mockResponse, {
        windowMs: 60000,
        maxRequests: 1000,
      });

      return {
        status: "healthy",
        details: {
          cache: "operational",
          rateLimit: "operational",
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
      };
    }
  }
}
```

## Testing

### Unit Testing

```typescript
describe("RateLimitMiddleware", () => {
  let middleware: RateLimitMiddleware;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockCacheService = {
      incrWithExpire: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    } as any;

    middleware = new RateLimitMiddleware(mockCacheService);
  });

  it("should allow requests within rate limit", async () => {
    mockCacheService.incrWithExpire.mockResolvedValue(5);

    const result = await middleware.applyRateLimit(
      { ip: "127.0.0.1", path: "/test" } as Request,
      { set: jest.fn() } as any,
      { windowMs: 60000, maxRequests: 10 },
    );

    expect(result).toBe(true);
    expect(mockCacheService.incrWithExpire).toHaveBeenCalledWith(
      "rate_limit:127.0.0.1:/test",
      60,
    );
  });

  it("should block requests over rate limit", async () => {
    mockCacheService.incrWithExpire.mockResolvedValue(11);

    await expect(
      middleware.applyRateLimit(
        { ip: "127.0.0.1", path: "/test" } as Request,
        { set: jest.fn() } as any,
        { windowMs: 60000, maxRequests: 10 },
      ),
    ).rejects.toThrow(TooManyRequestsException);
  });
});
```

### Integration Testing

```typescript
describe("Rate Limit Integration", () => {
  it("should enforce rate limits on auth endpoints", async () => {
    // Make requests up to the limit
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/auth/register")
        .send(validRegistrationData)
        .expect(400); // Email already exists
    }

    // Next request should be rate limited
    await request(app)
      .post("/api/auth/register")
      .send(validRegistrationData)
      .expect(429)
      .expect((res) => {
        expect(res.headers["x-ratelimit-limit"]).toBe("5");
        expect(res.headers["x-ratelimit-remaining"]).toBe("0");
      });
  });
});
```

## Best Practices

### Rate Limit Configuration Guidelines

1. **Security-First Approach**: Stricter limits for sensitive endpoints
2. **User Experience**: Generous limits for normal usage patterns
3. **Graceful Degradation**: Allow requests through on cache failures
4. **Monitoring**: Track rate limit violations and adjust accordingly

### Implementation Guidelines

```mermaid
graph TD
    BestPractices[Best Practices]

    BestPractices --> SecurityFirst[Security First]
    BestPractices --> UserExperience[User Experience]
    BestPractices --> Performance[Performance]
    BestPractices --> Monitoring[Monitoring]

    SecurityFirst --> StrictLimits[Strict Limits for Auth]
    SecurityFirst --> GradualIncrease[Gradual Limit Increases]
    SecurityFirst --> LogViolations[Log All Violations]

    UserExperience --> ClearHeaders[Clear HTTP Headers]
    UserExperience --> InformativeErrors[Informative Error Messages]
    UserExperience --> ReasonableLimits[Reasonable Limits]

    Performance --> EfficientStorage[Efficient Storage]
    Performance --> MinimalOverhead[Minimal Overhead]
    Performance --> CacheOptimization[Cache Optimization]

    Monitoring --> MetricsCollection[Metrics Collection]
    Monitoring --> AlertSystem[Alert System]
    Monitoring --> HealthChecks[Health Checks]
```

### Configuration Matrix

| Endpoint Type  | Window | Max Requests | Reasoning             |
| -------------- | ------ | ------------ | --------------------- |
| Authentication | 15 min | 3-10         | Prevent brute force   |
| Registration   | 15 min | 5            | Prevent spam accounts |
| Password Reset | 15 min | 3            | Prevent abuse         |
| API Endpoints  | 1 hour | 1000         | Normal usage          |
| File Upload    | 15 min | 10           | Resource intensive    |
| Email Sending  | 15 min | 5            | Prevent spam          |

## Troubleshooting

### Common Issues

1. **Rate Limits Not Working**
   - Check Redis connectivity
   - Verify decorator application
   - Review cache configuration

2. **False Positives**
   - Check key generation logic
   - Review IP extraction from proxy headers
   - Verify time window calculations

3. **Performance Issues**
   - Monitor cache hit rates
   - Check Redis latency
   - Review memory usage

4. **Configuration Problems**
   - Validate environment variables
   - Check rate limit values
   - Verify cache service initialization

### Debug Tools

```typescript
// Enable debug logging
process.env.LOG_LEVEL = "debug";

// Monitor rate limit operations
const debugMiddleware = new RateLimitMiddleware(cacheService);
debugMiddleware.enableDebugMode();

// Check cache health
const healthStatus = await cacheService.getHealthStatus();
console.log("Cache Health:", healthStatus);

// Monitor rate limit violations
app.use((req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode === 429) {
      console.log("Rate limit violation:", {
        ip: req.ip,
        path: req.path,
        headers: req.headers,
      });
    }
  });
  next();
});
```

## Related Systems

- **Authentication System**: Brute force protection for login endpoints
- **Caching System**: Storage layer for rate limit counters
- **Logging System**: Security event logging and monitoring
- **Health Monitoring**: System health checks and alerting
- **Error Handling**: Graceful error responses and fallbacks

## Future Enhancements

1. **Advanced Algorithms**: Token bucket, leaky bucket implementations
2. **User-Based Limits**: Authenticated user-specific rate limits
3. **Geographic Awareness**: Location-based rate limiting
4. **Dynamic Configuration**: Runtime rate limit adjustments
5. **Machine Learning**: Adaptive rate limiting based on usage patterns
6. **Distributed Coordination**: Cross-service rate limiting
7. **Real-time Monitoring**: Live rate limit violation tracking
