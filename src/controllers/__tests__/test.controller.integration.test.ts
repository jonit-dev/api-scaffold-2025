import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "@/app";
import { SupertestHelpers } from "@tests/utils/supertest.helpers";
import { HttpStatus } from "@common-types/http-status";

describe("Test Controller", () => {
  describe("GET /test/400", () => {
    it("should return 400 Bad Request", async () => {
      const response = await request(app).get("/test/400");

      await SupertestHelpers.expectBadRequestResponse(
        response,
        "Bad Request - Test endpoint",
      );
    });
  });

  describe("GET /test/401", () => {
    it("should return 401 Unauthorized", async () => {
      const response = await request(app).get("/test/401");

      await SupertestHelpers.expectUnauthorizedResponse(
        response,
        "Unauthorized - Test endpoint",
      );
    });
  });

  describe("GET /test/403", () => {
    it("should return 403 Forbidden", async () => {
      const response = await request(app).get("/test/403");

      await SupertestHelpers.expectForbiddenResponse(
        response,
        "Forbidden - Test endpoint",
      );
    });
  });

  describe("GET /test/404", () => {
    it("should return 404 Not Found", async () => {
      const response = await request(app).get("/test/404");

      await SupertestHelpers.expectNotFoundResponse(
        response,
        "Not Found - Test endpoint",
      );
    });
  });

  describe("GET /test/409", () => {
    it("should return 409 Conflict", async () => {
      const response = await request(app).get("/test/409");

      await SupertestHelpers.expectConflictResponse(
        response,
        "Conflict - Test endpoint",
      );
    });
  });

  describe("GET /test/422", () => {
    it("should return 422 Unprocessable Entity", async () => {
      const response = await request(app).get("/test/422");

      await SupertestHelpers.expectValidationErrorResponse(
        response,
        "Unprocessable Entity - Test endpoint",
      );
    });
  });

  describe("GET /test/500", () => {
    it("should return 500 Internal Server Error", async () => {
      const response = await request(app).get("/test/500");

      await SupertestHelpers.expectInternalServerErrorResponse(
        response,
        "Internal Server Error - Test endpoint",
      );
    });
  });

  describe("Error Response Structure", () => {
    it("should return consistent error response structure for all test endpoints", async () => {
      const testCases = [
        { endpoint: "/test/400", expectedStatus: HttpStatus.BadRequest },
        { endpoint: "/test/401", expectedStatus: HttpStatus.Unauthorized },
        { endpoint: "/test/403", expectedStatus: HttpStatus.Forbidden },
        { endpoint: "/test/404", expectedStatus: HttpStatus.NotFound },
        { endpoint: "/test/409", expectedStatus: HttpStatus.Conflict },
        {
          endpoint: "/test/422",
          expectedStatus: HttpStatus.UnprocessableEntity,
        },
        {
          endpoint: "/test/500",
          expectedStatus: HttpStatus.InternalServerError,
        },
      ];

      for (const testCase of testCases) {
        const response = await request(app).get(testCase.endpoint);

        expect(response.status).toBe(testCase.expectedStatus);
        expect(response.body).toEqual({
          success: false,
          error: expect.objectContaining({
            status: testCase.expectedStatus,
            message: expect.any(String),
            timestamp: expect.any(String),
          }),
        });
        expect(response.headers["content-type"]).toMatch(/json/);
      }
    });

    it("should include proper timestamp in error responses", async () => {
      const response = await request(app).get("/test/400");

      const timestamp = new Date(response.body.error.timestamp);
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - timestamp.getTime());

      expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
    });

    it("should return proper content-type headers", async () => {
      const response = await request(app).get("/test/404");

      expect(response.headers["content-type"]).toMatch(/application\/json/);
    });
  });

  describe("Non-existent test endpoints", () => {
    it("should return 404 for non-existent test endpoints", async () => {
      const response = await request(app).get("/test/999");

      expect(response.status).toBe(HttpStatus.NotFound);
    });

    it("should handle invalid HTTP methods on test endpoints", async () => {
      const response = await request(app).post("/test/400");

      expect(response.status).toBe(HttpStatus.NotFound);
    });
  });

  describe("Edge cases", () => {
    it("should handle concurrent requests to test endpoints", async () => {
      const testEndpoints = ["/test/400", "/test/401", "/test/403"];
      const requests = Array.from({ length: 5 }, (_, index) =>
        request(app).get(testEndpoints[index % testEndpoints.length]),
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      });
    });

    it("should maintain consistent response times", async () => {
      const startTime = Date.now();
      await request(app).get("/test/400");
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });
});
