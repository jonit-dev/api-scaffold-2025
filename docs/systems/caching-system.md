# Caching System

## Overview

The caching system provides a robust multi-tier caching solution with automatic fallback mechanisms. It implements both in-memory and Redis-based caching with a unified interface that gracefully degrades when Redis is unavailable.

## System Architecture

### High-Level Architecture

```mermaid
graph TB
    Application[Application Layer]
    CacheService[Cache Service]
    CacheManager[Cache Manager]
    MemoryStore[Memory Store L1]
    RedisStore[Redis Store L2]
    RedisClient[Raw Redis Client]

    Application --> CacheService
    CacheService --> CacheManager
    CacheManager --> MemoryStore
    CacheManager --> RedisStore
    CacheService --> RedisClient

    subgraph "Cache Layers"
        MemoryStore
        RedisStore
    end

    subgraph "External"
        Redis[(Redis Instance)]
    end

    RedisStore -.-> Redis
    RedisClient -.-> Redis
```

### Multi-Tier Caching Strategy

```mermaid
sequenceDiagram
    participant App as Application
    participant CS as CacheService
    participant CM as CacheManager
    participant Memory as Memory Store
    participant Redis as Redis Store

    App->>CS: get(key)
    CS->>CM: get(key)
    CM->>Memory: get(key)
    alt Found in Memory
        Memory-->>CM: value
        CM-->>CS: value
        CS-->>App: value
    else Not in Memory
        CM->>Redis: get(key)
        alt Found in Redis
            Redis-->>CM: value
            CM->>Memory: set(key, value)
            CM-->>CS: value
            CS-->>App: value
        else Not in Redis
            CM-->>CS: null
            CS-->>App: null
        end
    end
```

### Fallback Mechanism

```mermaid
graph TD
    Init[CacheService Initialize]
    SetupMemory[Setup Memory Store]
    TryRedis{Try Redis Connection}
    SetupRedis[Setup Redis Store]
    MemoryOnly[Memory-Only Mode]
    DualTier[Dual-Tier Mode]

    Init --> SetupMemory
    SetupMemory --> TryRedis
    TryRedis -->|Success| SetupRedis
    TryRedis -->|Failure| MemoryOnly
    SetupRedis --> DualTier

    MemoryOnly --> |Retry Connection| TryRedis

    subgraph "Cache Modes"
        MemoryOnly
        DualTier
    end
```

## Core Components

### CacheService Interface

```typescript
export interface ICacheService {
  // Basic Operations
  set(key: string, value: object, ttl?: number): Promise<void>;
  get<T = object>(key: string): Promise<T | null>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  expire(key: string, ttl: number): Promise<void>;
  ttl(key: string): Promise<number>;

  // Bulk Operations
  mset(keyValuePairs: Record<string, object>): Promise<void>;
  mget<T = object>(keys: string[]): Promise<(T | null)[]>;

  // Counter Operations
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  incrWithExpire(key: string, ttl: number): Promise<number>;

  // Pattern Operations
  keys(pattern: string): Promise<string[]>;
  clearByPattern(pattern: string): Promise<number>;

  // Advanced Operations
  cache<T>(
    key: string,
    fn: () => Promise<T>,
    options?: ICacheOptions,
  ): Promise<T>;
  invalidateCache(key: string, prefix?: string): Promise<void>;
  invalidateCachePattern(pattern: string, prefix?: string): Promise<number>;

  // Hash Operations (Redis-specific with fallback)
  hset(key: string, field: string, value: object): Promise<number>;
  hget<T = object>(key: string, field: string): Promise<T | null>;
  hdel(key: string, field: string): Promise<number>;
  hgetall<T = object>(key: string): Promise<Record<string, T>>;

  // List Operations (Redis-specific, limited fallback)
  lpush(key: string, ...values: object[]): Promise<number>;
  rpush(key: string, ...values: object[]): Promise<number>;
  lpop<T = object>(key: string): Promise<T | null>;
  rpop<T = object>(key: string): Promise<T | null>;
  llen(key: string): Promise<number>;

  // System Operations
  disconnect(): Promise<void>;
  getHealthStatus(): { redis: boolean; memory: boolean };
  getRedisClient(): Redis | null;
}
```

### Cache Configuration

```typescript
export interface ICacheOptions {
  ttl?: number;        // Time to live in seconds
  prefix?: string;     // Key prefix for organization
}

// Default configuration
private defaultTTL = 300; // 5 minutes
```

## Cache Operations

### Basic Cache Operations

```mermaid
graph TD
    Set[set key, value, ttl]
    Get[get key]
    Del[del key]
    Exists[exists key]
    Expire[expire key, ttl]
    TTL[ttl key]

    Set --> Memory[Update Memory Store]
    Set --> Redis[Update Redis Store]

    Get --> CheckMemory{Check Memory}
    CheckMemory -->|Hit| ReturnValue[Return Value]
    CheckMemory -->|Miss| CheckRedis{Check Redis}
    CheckRedis -->|Hit| UpdateMemory[Update Memory + Return]
    CheckRedis -->|Miss| ReturnNull[Return null]

    Del --> DelMemory[Delete from Memory]
    Del --> DelRedis[Delete from Redis]
```

### Cache-Aside Pattern

```mermaid
sequenceDiagram
    participant App as Application
    participant Cache as CacheService
    participant DB as Database

    App->>Cache: cache(key, fetchFn, options)
    Cache->>Cache: get(key)
    alt Cache Hit
        Cache-->>App: cached value
    else Cache Miss
        Cache->>DB: fetchFn()
        DB-->>Cache: fresh data
        Cache->>Cache: set(key, data, ttl)
        Cache-->>App: fresh data
    end
```

### Counter Operations

```mermaid
graph TD
    Incr[incr key]
    Decr[decr key]
    IncrExpire[incrWithExpire key, ttl]

    Incr --> GetCurrent[Get Current Value]
    GetCurrent --> |null| SetToOne[Set to 1]
    GetCurrent --> |value| IncrValue[Increment Value]
    IncrValue --> SetNew[Set New Value]

    IncrExpire --> |Redis Available| AtomicIncr[Redis Pipeline: INCR + EXPIRE]
    IncrExpire --> |Redis Unavailable| FallbackIncr[Separate incr + expire]
```

## Cache Decorators

### @Cache Decorator

```typescript
import { CacheService } from "../services/cache.service";

export function Cache(options: ICacheOptions = {}) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheService = Container.get(CacheService);
      const cacheKey = generateCacheKey(
        target.constructor.name,
        propertyName,
        args,
      );

      return await cacheService.cache(
        cacheKey,
        () => method.apply(this, args),
        options,
      );
    };
  };
}

// Usage example
export class UserService {
  @Cache({ ttl: 300, prefix: "user:" })
  async getUserById(id: string): Promise<User> {
    return await this.userRepository.findById(id);
  }
}
```

### Cache Key Generation

```mermaid
graph LR
    Input[Class + Method + Args]
    Hash[Generate Hash]
    Prefix[Add Prefix]
    FinalKey[Final Cache Key]

    Input --> Hash
    Hash --> Prefix
    Prefix --> FinalKey

    subgraph "Example"
        Ex1[UserService.getUserById id=123]
        Ex2[MD5 Hash]
        Ex3[user:UserService:getUserById:hash]
    end
```

## Redis Integration

### Redis Configuration

```typescript
// src/config/redis.ts
export class RedisConfig {
  private static client: Redis | null = null;

  static getClient(): Redis {
    if (!this.client) {
      this.client = new Redis(config.redis.url, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
    }
    return this.client;
  }
}
```

### Redis-Specific Operations

```mermaid
graph TD
    Pipeline[Redis Pipeline]
    Transaction[Redis Transaction]
    PubSub[Redis Pub/Sub]
    Streams[Redis Streams]

    Pipeline --> |Batch Operations| BatchCommands[Batch Multiple Commands]
    Transaction --> |ACID| AtomicOps[Atomic Operations]
    PubSub --> |Messaging| EventSystem[Event System]
    Streams --> |Log Processing| DataStreams[Data Streams]

    subgraph "Cache Service Integration"
        Pipeline
        Transaction
    end

    subgraph "Future Extensions"
        PubSub
        Streams
    end
```

## Cache Middleware

### Request-Level Caching

```typescript
export class CacheMiddleware {
  constructor(private cacheService: CacheService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const cacheKey = this.generateRequestCacheKey(req);
    const cached = await this.cacheService.get(cacheKey);

    if (cached) {
      res.json(cached);
      return;
    }

    // Intercept response
    const originalJson = res.json;
    res.json = (data: any) => {
      // Cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        this.cacheService.set(cacheKey, data, 300); // 5 minutes
      }
      return originalJson.call(res, data);
    };

    next();
  }
}
```

### HTTP Cache Headers

```mermaid
sequenceDiagram
    participant Client
    participant Middleware as Cache Middleware
    participant Cache as CacheService
    participant Controller

    Client->>Middleware: GET /api/users
    Middleware->>Cache: get(cache_key)
    alt Cache Hit
        Cache-->>Middleware: cached_data
        Middleware->>Middleware: Set Cache Headers
        Middleware-->>Client: 200 + Cache Headers + Data
    else Cache Miss
        Middleware->>Controller: Forward Request
        Controller-->>Middleware: Response Data
        Middleware->>Cache: set(cache_key, data)
        Middleware->>Middleware: Set Cache Headers
        Middleware-->>Client: 200 + Cache Headers + Data
    end
```

## Performance Optimization

### Cache Warming Strategies

```mermaid
graph TD
    AppStart[Application Start]
    WarmCritical[Warm Critical Data]
    WarmFrequent[Warm Frequent Queries]
    BackgroundRefresh[Background Refresh]

    AppStart --> WarmCritical
    WarmCritical --> WarmFrequent
    WarmFrequent --> BackgroundRefresh

    subgraph "Warming Strategies"
        PreWarm[Pre-warm on Deploy]
        LazyWarm[Lazy Load on First Request]
        ScheduledWarm[Scheduled Refresh]
    end

    WarmCritical --> PreWarm
    WarmFrequent --> LazyWarm
    BackgroundRefresh --> ScheduledWarm
```

### Cache Invalidation Patterns

```mermaid
graph TD
    DataChange[Data Change Event]
    InvalidationStrategy{Invalidation Strategy}

    InvalidationStrategy --> TTLExpiry[TTL-based Expiry]
    InvalidationStrategy --> ExplicitInvalidation[Explicit Invalidation]
    InvalidationStrategy --> TagBasedInvalidation[Tag-based Invalidation]
    InvalidationStrategy --> PatternInvalidation[Pattern-based Invalidation]

    TTLExpiry --> AutoExpire[Automatic Expiration]
    ExplicitInvalidation --> DirectDelete[Direct Key Deletion]
    TagBasedInvalidation --> TaggedKeys[Invalidate by Tags]
    PatternInvalidation --> WildcardMatch[Wildcard Pattern Matching]
```

### Cache Layers Performance

```mermaid
graph LR
    subgraph "Performance Characteristics"
        Memory[Memory Cache]
        Redis[Redis Cache]
        Database[Database]
    end

    Memory --> |~1ms| FastAccess[Ultra Fast]
    Redis --> |~5-10ms| MediumAccess[Fast]
    Database --> |~50-200ms| SlowAccess[Slower]

    subgraph "Trade-offs"
        Memory --> Limited[Limited Size]
        Redis --> Persistent[Persistent Storage]
        Database --> Authoritative[Source of Truth]
    end
```

## Error Handling

### Cache Failure Strategies

```mermaid
graph TD
    CacheOperation[Cache Operation]
    OperationFails{Operation Fails}

    OperationFails --> |Get| ReturnNull[Return null, Continue]
    OperationFails --> |Set| LogWarning[Log Warning, Continue]
    OperationFails --> |Critical| Fallback[Fallback to Database]

    subgraph "Graceful Degradation"
        ReturnNull
        LogWarning
        Fallback
    end

    LogWarning --> |Monitor| AlertSystem[Alert System]
    ReturnNull --> |Track| Metrics[Cache Miss Metrics]
```

### Redis Connection Management

```mermaid
sequenceDiagram
    participant App as Application
    participant CS as CacheService
    participant Redis as Redis

    App->>CS: Initialize
    CS->>Redis: Test Connection
    alt Connection Success
        Redis-->>CS: Connected
        CS->>CS: Enable Redis Features
    else Connection Failed
        Redis-->>CS: Connection Error
        CS->>CS: Disable Redis Features
        CS->>CS: Memory-Only Mode
    end

    Note over CS: Background reconnection attempts
    CS->>Redis: Periodic Health Check
```

## Monitoring and Observability

### Cache Metrics

```mermaid
graph TD
    Metrics[Cache Metrics]

    Metrics --> HitRate[Cache Hit Rate]
    Metrics --> MissRate[Cache Miss Rate]
    Metrics --> Latency[Response Latency]
    Metrics --> MemoryUsage[Memory Usage]
    Metrics --> RedisHealth[Redis Health]
    Metrics --> KeyDistribution[Key Distribution]

    subgraph "Monitoring Dashboard"
        HitRate --> |Target: >80%| HitRateAlert[Hit Rate Alert]
        Latency --> |Target: <10ms| LatencyAlert[Latency Alert]
        RedisHealth --> |Status| HealthAlert[Health Alert]
    end
```

### Health Check Integration

```typescript
export class CacheHealthCheck {
  constructor(private cacheService: CacheService) {}

  async checkHealth(): Promise<HealthStatus> {
    const status = this.cacheService.getHealthStatus();

    return {
      cache: {
        status: status.redis && status.memory ? "healthy" : "degraded",
        details: {
          memory: status.memory ? "operational" : "failed",
          redis: status.redis ? "operational" : "unavailable",
        },
      },
    };
  }
}
```

## Configuration

### Environment Variables

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_password
REDIS_DB=0

# Cache Configuration
CACHE_DEFAULT_TTL=300
CACHE_PREFIX=api_scaffold
CACHE_ENABLE_REDIS=true
CACHE_ENABLE_MEMORY=true

# Health Check
CACHE_HEALTH_CHECK_INTERVAL=30000
```

### Application Configuration

```typescript
export const cacheConfig = {
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || "0"),
  },
  cache: {
    defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || "300"),
    prefix: process.env.CACHE_PREFIX || "api_scaffold",
    enableRedis: process.env.CACHE_ENABLE_REDIS === "true",
    enableMemory: process.env.CACHE_ENABLE_MEMORY !== "false",
  },
  healthCheck: {
    interval: parseInt(process.env.CACHE_HEALTH_CHECK_INTERVAL || "30000"),
  },
};
```

## Best Practices

### Cache Key Design

```mermaid
graph TD
    KeyDesign[Cache Key Design]

    KeyDesign --> Hierarchical[Hierarchical Structure]
    KeyDesign --> Namespaced[Namespace Prefixes]
    KeyDesign --> Descriptive[Descriptive Names]
    KeyDesign --> Consistent[Consistent Patterns]

    Hierarchical --> |Example| Example1[user:profile:123]
    Namespaced --> |Example| Example2[api:v1:user:123]
    Descriptive --> |Example| Example3[user:recent_orders:123]
    Consistent --> |Example| Example4[entity:action:id]
```

### TTL Strategy

1. **Static Data**: Long TTL (1-24 hours)
2. **Dynamic Data**: Medium TTL (5-60 minutes)
3. **Real-time Data**: Short TTL (30 seconds - 5 minutes)
4. **User Sessions**: Session-based TTL

### Cache Invalidation

1. **Write-Through**: Update cache on data change
2. **Write-Behind**: Asynchronous cache updates
3. **Event-Driven**: Invalidate on specific events
4. **Time-Based**: Regular TTL expiration

## Testing

### Cache Testing Strategies

```typescript
describe("CacheService", () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = Container.get(CacheService);
  });

  it("should fallback to memory when Redis unavailable", async () => {
    // Mock Redis failure
    jest.spyOn(cacheService, "getRedisClient").mockReturnValue(null);

    await cacheService.set("test", { data: "value" });
    const result = await cacheService.get("test");

    expect(result).toEqual({ data: "value" });
  });

  it("should handle cache misses gracefully", async () => {
    const result = await cacheService.get("nonexistent");
    expect(result).toBeNull();
  });
});
```

### Performance Testing

```typescript
describe("Cache Performance", () => {
  it("should complete operations within latency targets", async () => {
    const start = Date.now();
    await cacheService.get("test_key");
    const latency = Date.now() - start;

    expect(latency).toBeLessThan(10); // 10ms target
  });
});
```

## Related Systems

- **Database System**: Cache layer for database queries
- **Authentication System**: Session and token caching
- **Rate Limiting System**: Request counter storage
- **Health Monitoring**: Cache health metrics
- **Logging System**: Cache operation logging

## Troubleshooting

### Common Issues

1. **Redis Connection Failures**
   - Check Redis server status
   - Verify connection parameters
   - Monitor network connectivity

2. **Memory Leaks**
   - Monitor memory usage
   - Check TTL configurations
   - Implement cache size limits

3. **Cache Inconsistency**
   - Review invalidation patterns
   - Check data update flows
   - Verify cache key generation

4. **Performance Issues**
   - Analyze cache hit rates
   - Review cache key distribution
   - Optimize TTL settings

### Debug Tools

```typescript
// Enable cache debugging
cacheService.enableDebugMode();

// Monitor cache operations
cacheService.onOperation((operation, key, duration) => {
  console.log(`Cache ${operation} for ${key} took ${duration}ms`);
});

// Check cache statistics
const stats = await cacheService.getStatistics();
console.log("Cache Hit Rate:", stats.hitRate);
```
