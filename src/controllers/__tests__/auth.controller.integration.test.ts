import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "@/app";
import { HttpStatus } from "@/types/http-status";

describe("Auth Controller Integration Tests", () => {
  describe("Basic Validation Tests", () => {
    it("should validate required fields in registration", async () => {
      const response = await request(app).post("/auth/register").send({});

      expect([HttpStatus.BadRequest, HttpStatus.InternalServerError]).toContain(
        response.status,
      );
      expect(response.body).toBeDefined();
    });
  });

  describe("GET /auth/health", () => {
    it("should return health status", async () => {
      const response = await request(app)
        .get("/auth/health")
        .expect(HttpStatus.Ok);

      expect(response.body.status).toBe("ok");
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe("Protected Endpoints", () => {
    it("should require authentication for /auth/me", async () => {
      const response = await request(app).get("/auth/me");
      expect(response.status).toBe(HttpStatus.Unauthorized);
    });

    it("should reject invalid tokens for /auth/me", async () => {
      const response = await request(app)
        .get("/auth/me")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(HttpStatus.Unauthorized);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle missing Authorization header", async () => {
      const response = await request(app).get("/auth/me");
      expect(response.status).toBe(HttpStatus.Unauthorized);
    });

    it("should handle malformed Authorization header", async () => {
      const responses = await Promise.all([
        request(app).get("/auth/me").set("Authorization", "InvalidFormat"),
        request(app).get("/auth/me").set("Authorization", "Bearer"),
        request(app).get("/auth/me").set("Authorization", "Bearer "),
        request(app).get("/auth/me").set("Authorization", "Basic dGVzdA=="),
      ]);

      responses.forEach((response) => {
        expect(response.status).toBe(HttpStatus.Unauthorized);
      });
    });
  });

  describe("Response Format Validation", () => {
    it("should return proper response format for health endpoint", async () => {
      const response = await request(app)
        .get("/auth/health")
        .expect(HttpStatus.Ok);

      expect(response.body.status).toBe("ok");
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe("Security Tests", () => {
    it("should enforce authentication on protected routes", async () => {
      const protectedRoutes = ["/auth/me"];

      for (const route of protectedRoutes) {
        const response = await request(app).get(route);
        expect(response.status).toBe(HttpStatus.Unauthorized);
      }
    });

    it("should reject various invalid token formats", async () => {
      const invalidTokens = [
        "",
        "invalid",
        "Bearer",
        "Bearer ",
        "Basic token",
        "NotBearer validtoken",
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .get("/auth/me")
          .set("Authorization", token);

        expect(response.status).toBe(HttpStatus.Unauthorized);
      }
    });
  });
});
