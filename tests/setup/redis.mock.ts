import { vi } from "vitest";
import RedisMock from "ioredis-mock";
import { Redis } from "ioredis";

// Create a singleton Redis mock instance
let redisMockInstance: any | null = null;

export interface IMockRedisClient extends Partial<Redis> {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
  hget: ReturnType<typeof vi.fn>;
  hset: ReturnType<typeof vi.fn>;
  hgetall: ReturnType<typeof vi.fn>;
  lpush: ReturnType<typeof vi.fn>;
  lpop: ReturnType<typeof vi.fn>;
  llen: ReturnType<typeof vi.fn>;
  keys: ReturnType<typeof vi.fn>;
  flushall: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
}

export function createRedisMock(): IMockRedisClient {
  if (!redisMockInstance) {
    redisMockInstance = new RedisMock({
      // Configure mock options
      data: {},
      lazyConnect: false, // Disable lazy connect to avoid connection issues
    });

    // Add event emitter methods that might be missing
    redisMockInstance.on = vi.fn();
    redisMockInstance.emit = vi.fn();
    redisMockInstance.removeAllListeners = vi.fn();
    redisMockInstance.disconnect = vi.fn().mockResolvedValue(undefined);
    redisMockInstance.connect = vi.fn().mockResolvedValue(undefined);

    // Ensure the mock is connected
    try {
      redisMockInstance.connect();
    } catch (error) {
      // Ignore connection errors in tests
      console.warn("Redis mock connection warning:", error);
    }
  }

  return redisMockInstance as IMockRedisClient;
}

export function resetRedisMock() {
  if (redisMockInstance) {
    try {
      redisMockInstance.flushall();
    } catch (error) {
      // Ignore connection errors during reset
      console.warn("Redis mock reset warning:", error);
    }
  }
}

export function getRedisMockInstance(): IMockRedisClient {
  return (redisMockInstance as IMockRedisClient) || createRedisMock();
}

// Mock the Redis config to return our mock instance
vi.mock("../../src/config/redis", () => ({
  RedisConfig: {
    getClient: vi.fn(() => createRedisMock()),
    disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));
