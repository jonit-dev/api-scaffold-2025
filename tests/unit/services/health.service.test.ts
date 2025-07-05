import { describe, it, expect, beforeEach, vi } from "vitest";
import { HealthService } from "@/services/health.service";
import { SupabaseClient } from "@supabase/supabase-js";
import { HealthFactory } from "../../factories/health.factory";
import { TestHelpers } from "../../utils/test.helpers";

describe("HealthService", () => {
  let healthService: HealthService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(() => {
    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    TestHelpers.setupMockSupabaseClient(mockSupabaseClient);
    healthService = new HealthService(mockSupabaseClient);
  });

  describe("getHealth", () => {
    it("should return healthy status when all services are operational", async () => {
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
              details: expect.any(String),
            }),
          }),
        })
      );
    });

    it("should return error status when database is unreachable", async () => {
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
        })
      );
    });

    it("should return warning status when database is slow", async () => {
      mockQueryBuilder.single.mockImplementation(() => {
        return new Promise(resolve => {
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
        })
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
        return new Promise(resolve => {
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
