import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "@/app";
import { SupertestHelpers } from "../../../tests/utils/supertest.helpers";
import { TestHelpers } from "../../../tests/utils/test.helpers";

describe("Health Controller", () => {
  beforeEach(() => {
    // Setup test environment
    TestHelpers.setupMockSupabaseClient({
      from: () => ({
        select: () => ({
          single: () =>
            Promise.resolve({ data: null, error: { message: "Test" } }),
        }),
      }),
    });
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/health");

      await SupertestHelpers.expectSuccessResponse(response);
      expect(response.body.data).toEqual(
        expect.objectContaining({
          status: expect.any(String),
          timestamp: expect.any(String),
          services: expect.objectContaining({
            database: expect.objectContaining({
              status: expect.any(String),
              response_time: expect.any(Number),
              details: expect.any(String),
            }),
          }),
        }),
      );
    });

    it("should include proper response headers", async () => {
      const response = await request(app).get("/health");

      expect(response.headers["content-type"]).toMatch(/application\/json/);
    });

    it("should return consistent response structure", async () => {
      const response = await request(app).get("/health");

      expect(response.body).toEqual(
        expect.objectContaining({
          success: expect.any(Boolean),
          data: expect.any(Object),
          message: expect.any(String),
          timestamp: expect.any(String),
        }),
      );
    });
  });

  describe("GET /health/detailed", () => {
    it("should return detailed health information", async () => {
      const response = await request(app).get("/health/detailed");

      await SupertestHelpers.expectSuccessResponse(response);
      expect(response.body.data).toEqual(
        expect.objectContaining({
          status: expect.any(String),
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          version: expect.any(String),
          environment: expect.any(String),
          services: expect.any(Object),
        }),
      );
    });

    it("should include system metrics in detailed response", async () => {
      const response = await request(app).get("/health/detailed");

      expect(response.body.data.system).toBeDefined();
    });
  });
});
