import { config } from "@config/env";
import { SQLiteConfig } from "@config/sqlite";
import { HealthService } from "@services/health.service";
import { TestHelpers } from "@tests/utils/test.helpers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("HealthService", () => {
  let healthService: HealthService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;
  let originalProvider: string;
  let mockDb: any;

  beforeEach(() => {
    // Store original provider
    originalProvider = config.database.provider;

    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    // Mock SQLite database
    mockDb = {
      prepare: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({ health_check: 1 }),
      }),
    };

    TestHelpers.setupMockSupabaseClient(mockSupabaseClient);
  });

  afterEach(() => {
    // Restore original provider
    config.database.provider = originalProvider as "sqlite" | "supabase";
    vi.restoreAllMocks();
  });

  describe("getHealth with SQLite", () => {
    beforeEach(() => {
      config.database.provider = "sqlite";
      vi.spyOn(SQLiteConfig, "getClient").mockReturnValue(mockDb as any);
      healthService = new HealthService(mockSupabaseClient);
    });

    it("should return healthy status when SQLite is operational", async () => {
      const result = await healthService.getHealth();

      expect(result).toEqual(
        expect.objectContaining({
          status: "ok",
          timestamp: expect.any(Date),
          services: expect.objectContaining({
            database: expect.objectContaining({
              status: "ok",
              response_time: expect.any(Number),
              details: expect.stringContaining("SQLite"),
            }),
          }),
        }),
      );
    });

    it("should return error status when SQLite fails", async () => {
      mockDb.prepare.mockReturnValue({
        get: vi.fn().mockImplementation(() => {
          throw new Error("SQLite connection failed");
        }),
      });

      const result = await healthService.getHealth();

      expect(result).toEqual(
        expect.objectContaining({
          status: "error",
          services: expect.objectContaining({
            database: expect.objectContaining({
              status: "error",
              details: expect.stringContaining("SQLite connection failed"),
            }),
          }),
        }),
      );
    });

    it("should return warning status when SQLite is slow", async () => {
      mockDb.prepare.mockReturnValue({
        get: vi.fn().mockImplementation(() => {
          // Simulate slow response by using setTimeout
          const start = Date.now();
          while (Date.now() - start < 1100) {
            // Busy wait for 1.1 seconds
          }
          return { health_check: 1 };
        }),
      });

      const result = await healthService.getHealth();

      expect(result).toEqual(
        expect.objectContaining({
          status: "warning",
          services: expect.objectContaining({
            database: expect.objectContaining({
              status: "warning",
              details: expect.stringContaining("slow"),
            }),
          }),
        }),
      );
    });
  });

  describe("getHealth with Supabase", () => {
    beforeEach(() => {
      config.database.provider = "supabase";
      healthService = new HealthService(mockSupabaseClient);
    });

    it("should return healthy status when Supabase is operational", async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { result: 1 },
        error: null,
      });

      const result = await healthService.getHealth();

      expect(result).toEqual(
        expect.objectContaining({
          status: "ok",
          timestamp: expect.any(Date),
          services: expect.objectContaining({
            database: expect.objectContaining({
              status: "ok",
              response_time: expect.any(Number),
              details: expect.stringContaining("Supabase"),
            }),
          }),
        }),
      );
    });

    it("should return error status when Supabase is unreachable", async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: "Connection failed" },
      });

      const result = await healthService.getHealth();

      expect(result).toEqual(
        expect.objectContaining({
          status: "error",
          services: expect.objectContaining({
            database: expect.objectContaining({
              status: "error",
              details: expect.stringContaining("Connection failed"),
            }),
          }),
        }),
      );
    });

    it("should return warning status when Supabase is slow", async () => {
      mockQueryBuilder.single.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              data: { result: 1 },
              error: null,
            });
          }, 1500);
        });
      });

      const result = await healthService.getHealth();

      expect(result).toEqual(
        expect.objectContaining({
          status: "warning",
          services: expect.objectContaining({
            database: expect.objectContaining({
              status: "warning",
              response_time: expect.any(Number),
              details: expect.stringContaining("slow"),
            }),
          }),
        }),
      );
    });

    it("should handle service timeout gracefully", async () => {
      mockQueryBuilder.single.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Timeout")), 100);
        });
      });

      const result = await healthService.getHealth();

      expect(result.status).toBe("error");
      expect(result.services.database.status).toBe("error");
      expect(result.services.database.details).toContain("Timeout");
    });

    it("should measure response times accurately", async () => {
      mockQueryBuilder.single.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              data: { result: 1 },
              error: null,
            });
          }, 100);
        });
      });

      const result = await healthService.getHealth();

      expect(result.services.database.response_time).toBeGreaterThan(90);
      expect(result.services.database.response_time).toBeLessThan(200);
    });
  });
});
