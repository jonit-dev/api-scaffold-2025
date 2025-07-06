# Caching Guide

This guide explains how to use the caching system in the application. The system provides automatic fallback from Redis to in-memory caching when Redis is unavailable.

## Architecture

The caching system uses a layered approach:

1. **Primary Layer**: Redis (persistent, distributed)
2. **Fallback Layer**: In-memory cache (temporary, process-local)
3. **Automatic Fallback**: When Redis is unavailable, the system automatically falls back to memory-only caching

## Getting Started

### Accessing Cache Services

The caching system is available through the `CacheService` - the only public caching interface:

#### CacheService (Only Public Interface)

Provides comprehensive caching API with automatic Redis fallback:

```typescript
import { Service } from "typedi";
import { CacheService } from "@services/cache.service";

// ✅ RECOMMENDED - Constructor injection
@Service()
export class MyService {
  constructor(private cache: CacheService) {}

  // Use this.cache for all caching operations
}
```

The `CacheService` is the sole public interface and includes all functionality:

- Basic key-value operations (`get`, `set`, `del`)
- Redis-specific operations (`hset`, `hget`, `lpush`, etc.) with fallback
- Advanced operations (`incrWithExpire`, `getRedisClient`)
- Cache wrapper methods (`cache`, `invalidateCache`)
- Health monitoring (`getHealthStatus`)

**Important**: Redis operations are handled internally by CacheService. There is no direct RedisService usage in the application.

## System Status

The system automatically detects Redis availability at startup:

- **✅ Redis Available**: Uses Redis + Memory (multi-tier caching)
- **⚠️ Redis Unavailable**: Uses Memory-only caching with warning

Check cache health status:

```typescript
@Service()
export class MyService {
  constructor(private cache: CacheService) {}

  async checkCacheHealth() {
    const health = this.cache.getHealthStatus();
    console.log(`Redis: ${health.redis ? "Available" : "Unavailable"}`);
    console.log(`Memory: ${health.memory ? "Available" : "Unavailable"}`);
  }
}
```

## Basic Operations

### Set and Get Values

```typescript
// Set a value with optional TTL (Time To Live)
await cache.set("user:123", { name: "John", email: "john@example.com" });
await cache.set("session:abc", { userId: "123" }, 3600); // Expires in 1 hour

// Get a value
const user = await cache.get("user:123");
const session = await cache.get<{ userId: string }>("session:abc");

// Delete a value
await cache.del("user:123");
```

### Check Existence and TTL

```typescript
// Check if key exists
const exists = await cache.exists("user:123");

// Set expiration on existing key
await cache.expire("user:123", 3600);

// Get remaining TTL (Redis only - returns -1 in memory mode)
const timeLeft = await cache.ttl("user:123");
```

### Multiple Operations

```typescript
// Set multiple values at once
await cache.mset({
  "user:123": { name: "John" },
  "user:456": { name: "Jane" },
  "config:theme": { dark: true },
});

// Get multiple values
const values = await cache.mget(["user:123", "user:456"]);
```

## Advanced Operations

### Atomic Operations

```typescript
// Atomic increment with expiration (Redis pipeline when available)
const count = await cache.incrWithExpire("rate_limit:user:123", 3600);

// Access raw Redis client for advanced operations (use sparingly)
const redisClient = cache.getRedisClient();
if (redisClient) {
  // Direct Redis operations when needed
  const result = await redisClient
    .pipeline()
    .incr("counter")
    .expire("counter", 300)
    .exec();
}
```

### Pattern-based Operations

```typescript
// Get all keys matching a pattern (Redis only)
const userKeys = await cache.keys("user:*");

// Clear all keys matching a pattern
await cache.clearByPattern("session:*");
```

### Counters

```typescript
// Increment/decrement counters
await cache.incr("page:views");
await cache.decr("user:credits:123");

const views = await cache.get<number>("page:views");
```

## Fallback Behavior

### Full Fallback Support

These operations work seamlessly in both Redis and memory modes:

- `set()`, `get()`, `del()` - Basic key-value operations
- `exists()` - Key existence checks
- `expire()` - TTL management (memory has limited TTL precision)
- `mset()`, `mget()` - Multiple operations
- `incr()`, `decr()` - Counters
- `cache()` - Cache wrapper functions
- `invalidateCache()` - Cache invalidation

### Limited Fallback Support

These operations have reduced functionality in memory-only mode:

#### Hash Operations

```typescript
// Works in Redis, uses flattened keys in memory
await cache.hset("user:123", "name", { value: "John Doe" });
await cache.hset("user:123", "email", { value: "john@example.com" });

// Get single field (works in both modes)
const name = await cache.hget("user:123", "name");

// Get all fields (Redis only - returns empty object in memory)
const userData = await cache.hgetall("user:123");

// Delete a field
await cache.hdel("user:123", "email");
```

#### List Operations

```typescript
// These operations only work with Redis
// In memory mode, they return default values and log warnings

await cache.lpush(
  "notifications:123",
  { message: "Welcome!", type: "info" },
  { message: "Profile updated", type: "success" },
);

const notification = await cache.lpop("notifications:123");
const count = await cache.llen("notifications:123");
```

### Pattern Operations

```typescript
// Pattern matching only works with Redis
// In memory mode, returns empty arrays

const keys = await cache.keys("user:*");
const cleared = await cache.clearByPattern("session:*");
```

## Caching Patterns

### Simple Cache Wrapper

The `cache()` method automatically handles cache-miss scenarios:

```typescript
// Will check cache first, call function if miss, then store result
const userData = await cache.cache(
  "user:123",
  async () => {
    // This function only runs on cache miss
    return await userRepository.findById("123");
  },
  { ttl: 3600, prefix: "user:" },
);
```

### Manual Cache Management

```typescript
@Service()
export class UserService {
  constructor(
    private cache: CacheService,
    private userRepository: UserRepository,
  ) {}

  async getUser(id: string) {
    // Try cache first
    const cached = await this.cache.get(`user:${id}`);
    if (cached) return cached;

    // Fetch from database
    const user = await this.userRepository.findById(id);

    // Cache for 1 hour
    await this.cache.set(`user:${id}`, user, 3600);

    return user;
  }

  async updateUser(id: string, data: any) {
    const user = await this.userRepository.update(id, data);

    // Update cache
    await this.cache.set(`user:${id}`, user, 3600);

    return user;
  }

  async deleteUser(id: string) {
    await this.userRepository.delete(id);

    // Clear cache
    await this.cache.del(`user:${id}`);
  }
}
```

### Cache Invalidation

```typescript
// Clear specific cache entry
await cache.invalidateCache("user:123");

// Clear all user caches (Redis only)
await cache.invalidateCachePattern("user:*");

// Clear with custom prefix
await cache.invalidateCache("profile:123", "profiles:");
```

## Common Use Cases

### Session Storage

```typescript
@Service()
export class SessionService {
  constructor(private cache: CacheService) {}

  async createSession(userId: string, sessionData: any) {
    const sessionId = generateId();
    const key = `session:${sessionId}`;

    await this.cache.set(
      key,
      {
        userId,
        ...sessionData,
        createdAt: Date.now(),
      },
      86400, // 24 hours
    );

    return sessionId;
  }

  async getSession(sessionId: string) {
    return await this.cache.get(`session:${sessionId}`);
  }

  async extendSession(sessionId: string) {
    await this.cache.expire(`session:${sessionId}`, 86400);
  }

  async destroySession(sessionId: string) {
    await this.cache.del(`session:${sessionId}`);
  }
}
```

### Rate Limiting

```typescript
@Service()
export class RateLimitService {
  constructor(private cache: CacheService) {}

  async isRateLimited(userId: string, limit = 100, window = 3600) {
    const key = `rate:${userId}:${Math.floor(Date.now() / (window * 1000))}`;

    const count = await this.cache.incr(key);

    if (count === 1) {
      await this.cache.expire(key, window);
    }

    return count > limit;
  }
}
```

### Distributed Locks (Advanced)

For distributed locking, you would need to implement custom logic using the basic cache operations. Here's a simple example:

```typescript
@Service()
export class LockService {
  constructor(private cache: CacheService) {}

  async acquireLock(resource: string, ttl = 30): Promise<string | null> {
    const lockKey = `lock:${resource}`;
    const lockValue = generateId();

    // Check if lock already exists
    const exists = await this.cache.exists(lockKey);
    if (exists) {
      return null;
    }

    // Set the lock with TTL
    await this.cache.set(
      lockKey,
      { owner: lockValue, timestamp: Date.now() },
      ttl,
    );

    return lockValue;
  }

  async releaseLock(resource: string, lockValue: string): Promise<boolean> {
    const lockKey = `lock:${resource}`;

    // Check if we own the lock
    const lockData = await this.cache.get<{ owner: string }>(lockKey);
    if (lockData?.owner === lockValue) {
      await this.cache.del(lockKey);
      return true;
    }

    return false;
  }
}
```

## Best Practices

### 1. Design for Fallback

Always design your caching logic to work in both Redis and memory modes:

```typescript
// ✅ Good - Works in both modes
async function getCachedUser(id: string) {
  return await cache.cache(`user:${id}`, async () => {
    return await userRepository.findById(id);
  });
}

// ❌ Avoid - Redis-specific features as critical path
async function getCachedUserBad(id: string) {
  const keys = await cache.keys(`user:${id}:*`); // Doesn't work in memory mode
  // ... logic that depends on pattern matching
}
```

### 2. Handle Graceful Degradation

```typescript
@Service()
export class CacheService {
  constructor(private cache: CacheService) {}

  async safeGet<T>(key: string, fallback: () => Promise<T>): Promise<T> {
    try {
      const cached = await this.cache.get<T>(key);
      if (cached) return cached;
    } catch (error) {
      console.warn(`Cache get failed for key ${key}:`, error);
    }

    return await fallback();
  }

  async safeSet(key: string, value: any, ttl?: number): Promise<void> {
    try {
      await this.cache.set(key, value, ttl);
    } catch (error) {
      console.warn(`Cache set failed for key ${key}:`, error);
    }
  }
}
```

### 3. Use Appropriate TTLs

```typescript
// Always set TTL for temporary data
await cache.set("session:123", data, 3600); // 1 hour
await cache.set("cache:user:123", data, 300); // 5 minutes
await cache.set("token:reset:123", data, 600); // 10 minutes
```

### 4. Key Naming Conventions

```typescript
// Use consistent, hierarchical naming
"user:123:profile";
"session:abc123";
"cache:user:123";
"queue:emails";
"lock:resource:payment:123";
```

### 5. Monitor Cache Health

```typescript
@Service()
export class HealthService {
  constructor(private cache: CacheService) {}

  async getCacheHealth() {
    const health = this.cache.getHealthStatus();
    return {
      redis: health.redis,
      memory: health.memory,
      status: health.redis ? "optimal" : "degraded",
    };
  }
}
```

## Configuration

Cache configuration is handled in `src/config/env.ts`. Environment variables:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_URL=redis://localhost:6379
```

## Testing

In tests, both Redis and cache services are automatically mocked. The mock behaves like the real system but stores data in memory:

```typescript
describe("MyService", () => {
  it("should cache user data", async () => {
    const service = Container.get(MyService);

    // This uses the mocked cache - no setup needed
    await service.cacheUser("123", { name: "John" });

    const cached = await service.getCachedUser("123");
    expect(cached).toEqual({ name: "John" });
  });
});
```

## Migration Notes

### Architecture Changes

- **Single Public Interface**: CacheService is now the only public caching API
- **Internal Redis**: Redis operations are handled internally by CacheService
- **No Direct RedisService**: Applications should not use RedisService directly
- **Automatic fallback**: System gracefully handles Redis unavailability
- **Enhanced logging**: Warnings when Redis-specific features are used in memory mode
- **Consistent API**: Same interface regardless of backend

### Migration from RedisService

If you were previously using RedisService directly:

```typescript
// ❌ OLD - Direct RedisService usage
@Service()
export class MyService {
  constructor(private redisService: RedisService) {}
}

// ✅ NEW - Use CacheService instead
@Service()
export class MyService {
  constructor(private cacheService: CacheService) {}
}
```

### Performance Considerations

- **Memory mode**: Faster for local operations, data doesn't persist
- **Redis mode**: Slower network calls, but data persists across restarts
- **Multi-tier**: Best of both worlds when Redis is available

### Deployment Considerations

- **Local development**: Can work without Redis
- **Production**: Redis recommended for persistence and performance
- **Staging**: Can test fallback behavior by temporarily disabling Redis
