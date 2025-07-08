import { vi } from "vitest";
import { Container } from "typedi";
import { HealthService } from "../../src/services/health.service";

// Mock HealthService
export const createMockHealthService = () => ({
  getHealth: vi.fn().mockResolvedValue({
    status: "ok",
    timestamp: new Date(),
    services: {
      database: {
        status: "ok",
        response_time: 10,
        details: "SQLite database connection healthy",
      },
    },
  }),
  getDatabaseHealth: vi.fn().mockResolvedValue({
    status: "healthy",
    responseTime: 10,
    message: "SQLite database connection successful",
  }),
  getSystemHealth: vi.fn().mockResolvedValue({
    status: "healthy",
    timestamp: new Date(),
    uptime: 100,
    version: "1.0.0",
    environment: "test",
    services: {
      database: {
        status: "healthy",
        responseTime: 10,
        message: "SQLite database connection successful",
      },
    },
    system: {
      memory: {
        used: 50000000,
        total: 100000000,
        external: 5000000,
      },
    },
  }),
});

// Register health mock
export const registerHealthMocks = () => {
  Container.set(HealthService, createMockHealthService());
};

// Reset health mocks
export const resetHealthMocks = () => {
  const healthService = Container.get(HealthService) as any;

  if (healthService) {
    Object.values(healthService).forEach((fn: any) => {
      if (fn && typeof fn.mockClear === "function") {
        fn.mockClear();
      }
    });
  }
};
