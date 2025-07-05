# Redis Guide

This guide explains how to use Redis in the application for caching, session management, and data storage.

## Getting Started

### Accessing Redis Service

Redis is available through TypeDI constructor injection (recommended for performance):

```typescript
import { Service } from "typedi";
import { RedisService } from "@services/redis.service";

// ✅ RECOMMENDED - Constructor injection (most efficient)
@Service()
export class MyService {
  constructor(private redis: RedisService) {}

  // Use this.redis in your methods
}

// ❌ Less efficient - Container.get() per access
@Service()
export class LessEfficientService {
  private redis = Container.get(RedisService); // Runtime lookup overhead
}
```

## Basic Operations

### Set and Get Values

```typescript
// Set a value with optional TTL (Time To Live)
await redis.set("user:123", { name: "John", email: "john@example.com" });
await redis.set("session:abc", { userId: "123" }, 3600); // Expires in 1 hour

// Get a value
const user = await redis.get("user:123");
const session = await redis.get<{ userId: string }>("session:abc");

// Delete a value
await redis.del("user:123");
```

### Check Existence and TTL

```typescript
// Check if key exists
const exists = await redis.exists("user:123");

// Set expiration on existing key
await redis.expire("user:123", 3600);

// Get remaining TTL
const timeLeft = await redis.ttl("user:123");
```

### Multiple Operations

```typescript
// Set multiple values at once
await redis.mset({
  "user:123": { name: "John" },
  "user:456": { name: "Jane" },
  "config:theme": { dark: true },
});

// Get multiple values
const values = await redis.mget(["user:123", "user:456"]);
```

## Advanced Operations

### Pattern-based Operations

```typescript
// Get all keys matching a pattern
const userKeys = await redis.keys("user:*");

// Clear all keys matching a pattern
await redis.clearByPattern("session:*");
```

### Counters

```typescript
// Increment/decrement counters
await redis.incr("page:views");
await redis.decr("user:credits:123");

const views = await redis.get<number>("page:views");
```

## Hash Operations

Perfect for storing object fields separately:

```typescript
// Set hash fields
await redis.hset("user:123", "name", { value: "John Doe" });
await redis.hset("user:123", "email", { value: "john@example.com" });

// Get single field
const name = await redis.hget("user:123", "name");

// Get all fields
const userData = await redis.hgetall("user:123");

// Delete a field
await redis.hdel("user:123", "email");
```

## List Operations

Great for queues, activity feeds, or ordered data:

```typescript
// Add to list (left side)
await redis.lpush(
  "notifications:123",
  { message: "Welcome!", type: "info" },
  { message: "Profile updated", type: "success" },
);

// Add to list (right side)
await redis.rpush("activity:123", { action: "login", timestamp: Date.now() });

// Remove from list
const notification = await redis.lpop("notifications:123");
const lastActivity = await redis.rpop("activity:123");

// Get list length
const notificationCount = await redis.llen("notifications:123");
```

## Caching Patterns

### Simple Cache Wrapper

The `cache()` method automatically handles cache-miss scenarios:

```typescript
// Will check cache first, call function if miss, then store result
const userData = await redis.cache(
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
    private redis: RedisService,
    private userRepository: UserRepository,
  ) {}

  async getUser(id: string) {
    // Try cache first
    const cached = await this.redis.get(`user:${id}`);
    if (cached) return cached;

    // Fetch from database
    const user = await this.userRepository.findById(id);

    // Cache for 1 hour
    await this.redis.set(`user:${id}`, user, 3600);

    return user;
  }

  async updateUser(id: string, data: any) {
    const user = await this.userRepository.update(id, data);

    // Update cache
    await this.redis.set(`user:${id}`, user, 3600);

    return user;
  }

  async deleteUser(id: string) {
    await this.userRepository.delete(id);

    // Clear cache
    await this.redis.del(`user:${id}`);
  }
}
```

### Cache Invalidation

```typescript
// Clear specific cache entry
await redis.invalidateCache("user:123");

// Clear all user caches
await redis.invalidateCachePattern("user:*");

// Clear with custom prefix
await redis.invalidateCache("profile:123", "profiles:");
```

## Common Use Cases

### Session Storage

```typescript
@Service()
export class SessionService {
  constructor(private redis: RedisService) {}

  async createSession(userId: string, sessionData: any) {
    const sessionId = generateId();
    const key = `session:${sessionId}`;

    await this.redis.set(
      key,
      {
        userId,
        ...sessionData,
        createdAt: Date.now(),
      },
      86400,
    ); // 24 hours

    return sessionId;
  }

  async getSession(sessionId: string) {
    return await this.redis.get(`session:${sessionId}`);
  }

  async extendSession(sessionId: string) {
    await this.redis.expire(`session:${sessionId}`, 86400);
  }

  async destroySession(sessionId: string) {
    await this.redis.del(`session:${sessionId}`);
  }
}
```

### Rate Limiting

```typescript
@Service()
export class RateLimitService {
  constructor(private redis: RedisService) {}

  async isRateLimited(userId: string, limit = 100, window = 3600) {
    const key = `rate:${userId}:${Math.floor(Date.now() / (window * 1000))}`;

    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, window);
    }

    return count > limit;
  }
}
```

### Distributed Locks

```typescript
@Service()
export class LockService {
  constructor(private redis: RedisService) {}

  async acquireLock(resource: string, ttl = 30) {
    const lockKey = `lock:${resource}`;
    const lockValue = generateId();

    // Try to set lock (NX = only if not exists)
    const client = this.redis.getClient();
    const result = await client.set(lockKey, lockValue, "EX", ttl, "NX");

    return result === "OK" ? lockValue : null;
  }

  async releaseLock(resource: string, lockValue: string) {
    const lockKey = `lock:${resource}`;
    const client = this.redis.getClient();

    // Lua script to atomically check and delete
    const script = `
      if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
      else
        return 0
      end
    `;

    return await client.eval(script, 1, lockKey, lockValue);
  }
}
```

### Activity Feeds

```typescript
@Service()
export class ActivityService {
  constructor(private redis: RedisService) {}

  async addActivity(userId: string, activity: any) {
    const key = `feed:${userId}`;

    // Add to front of list
    await this.redis.lpush(key, {
      ...activity,
      timestamp: Date.now(),
    });

    // Keep only last 100 activities
    const client = this.redis.getClient();
    await client.ltrim(key, 0, 99);

    // Set expiration
    await this.redis.expire(key, 86400 * 30); // 30 days
  }

  async getActivityFeed(userId: string, limit = 20) {
    const key = `feed:${userId}`;
    const client = this.redis.getClient();

    const activities = await client.lrange(key, 0, limit - 1);
    return activities.map((activity) => JSON.parse(activity));
  }
}
```

## Best Practices

### 1. Key Naming Conventions

```typescript
// Use consistent, hierarchical naming
"user:123:profile";
"session:abc123";
"cache:user:123";
"queue:emails";
"lock:resource:payment:123";
```

### 2. Set Appropriate TTLs

```typescript
// Always set TTL for temporary data
await redis.set("session:123", data, 3600); // 1 hour
await redis.set("cache:user:123", data, 300); // 5 minutes
await redis.set("token:reset:123", data, 600); // 10 minutes
```

### 3. Handle Errors Gracefully

```typescript
@Service()
export class CacheService {
  constructor(private redis: RedisService) {}

  async safeGet<T>(key: string, fallback: () => Promise<T>): Promise<T> {
    try {
      const cached = await this.redis.get<T>(key);
      if (cached) return cached;
    } catch (error) {
      console.warn(`Redis get failed for key ${key}:`, error);
    }

    return await fallback();
  }

  async safeSet(key: string, value: any, ttl?: number): Promise<void> {
    try {
      await this.redis.set(key, value, ttl);
    } catch (error) {
      console.warn(`Redis set failed for key ${key}:`, error);
    }
  }
}
```

### 4. Memory Management

```typescript
// Use hash operations for related data instead of separate keys
await redis.hset("user:123", "profile", userData);
await redis.hset("user:123", "preferences", userPrefs);

// Instead of:
await redis.set("user:123:profile", userData);
await redis.set("user:123:preferences", userPrefs);
```

## Configuration

Redis configuration is handled in `src/config/redis.ts`. Environment variables:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
```

## Testing

In tests, Redis is automatically mocked. The mock behaves like real Redis but stores data in memory:

```typescript
describe("MyService", () => {
  it("should cache user data", async () => {
    const service = Container.get(MyService);

    // This uses the mocked Redis - no setup needed
    await service.cacheUser("123", { name: "John" });

    const cached = await service.getCachedUser("123");
    expect(cached).toEqual({ name: "John" });
  });
});
```

## Advanced Redis Client

For operations not covered by RedisService, access the raw client:

```typescript
const client = redis.getClient();

// Use any Redis command
await client.zadd("leaderboard", 100, "user:123");
await client.zrange("leaderboard", 0, 9, "WITHSCORES");

// Pipelines for multiple operations
const pipeline = client.pipeline();
pipeline.set("key1", "value1");
pipeline.set("key2", "value2");
await pipeline.exec();
```
