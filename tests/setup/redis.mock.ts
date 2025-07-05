import { vi } from "vitest";
import RedisMock from "ioredis-mock";

// Create a singleton Redis mock instance
let redisMockInstance: any = null;

export function createRedisMock() {
  if (!redisMockInstance) {
    redisMockInstance = new RedisMock({
      // Configure mock options
      data: {},
      lazyConnect: true,
    });

    // Add event emitter methods
    redisMockInstance.on = vi.fn();
    redisMockInstance.emit = vi.fn();
    redisMockInstance.removeAllListeners = vi.fn();
    redisMockInstance.disconnect = vi.fn().mockResolvedValue(undefined);
  }

  return redisMockInstance;
}

export function resetRedisMock() {
  if (redisMockInstance) {
    redisMockInstance.flushall();
  }
}

export function getRedisMockInstance() {
  return redisMockInstance;
}

// Mock the Redis config to return our mock instance
vi.mock("../../src/config/redis", () => ({
  RedisConfig: {
    getClient: () => createRedisMock(),
    disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));
