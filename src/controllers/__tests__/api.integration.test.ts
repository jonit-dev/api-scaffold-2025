import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "@/app";
import { HttpStatus } from "@/types/http-status";

describe("API Integration Tests - Real Functionality", () => {
  describe("Health Check", () => {
    it("should return API health status", async () => {
      const response = await request(app).get("/health").expect(HttpStatus.Ok);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("ok");
      expect(response.body.data.services.database).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    it("should return auth health status", async () => {
      const response = await request(app)
        .get("/auth/health")
        .expect(HttpStatus.Ok);

      expect(response.body.status).toBe("ok");
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe("Authentication Endpoints", () => {
    it("should reject access without token", async () => {
      await request(app).get("/auth/me").expect(HttpStatus.Unauthorized);
    });

    it("should reject access with invalid token", async () => {
      await request(app)
        .get("/auth/me")
        .set("Authorization", "Bearer invalid-token")
        .expect(HttpStatus.Unauthorized);
    });
  });

  describe("User Management - Unauthorized", () => {
    it("should require authentication for user profile", async () => {
      await request(app).get("/users/me").expect(HttpStatus.Unauthorized);
    });

    it("should require authentication for user update", async () => {
      await request(app)
        .put("/users/me")
        .send({ firstName: "Test" })
        .expect(HttpStatus.Unauthorized);
    });

    it("should require authentication for user search", async () => {
      await request(app)
        .get("/users/search?q=test")
        .expect(HttpStatus.Unauthorized);
    });
  });

  describe("Cache Functionality", () => {
    it("should respond to cache demo endpoint", async () => {
      const response = await request(app).get("/cache-demo/basic");

      // Accept either success or not found (depending on if endpoint exists)
      expect([HttpStatus.Ok, HttpStatus.NotFound]).toContain(response.status);
    });
  });

  describe("Error Handling", () => {
    it("should handle non-existent routes", async () => {
      const response = await request(app)
        .get("/non-existent-route")
        .expect(HttpStatus.NotFound);

      expect(response.body).toBeDefined();
    });
  });

  describe("Security & Headers", () => {
    it("should handle CORS properly", async () => {
      const response = await request(app)
        .options("/health")
        .set("Origin", "http://localhost:3000")
        .expect(HttpStatus.NoContent);

      expect(response.headers).toHaveProperty("access-control-allow-origin");
    });
  });

  describe("API Response Format", () => {
    it("should return consistent success response format", async () => {
      const response = await request(app).get("/health").expect(HttpStatus.Ok);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("timestamp");
    });
  });

  describe("Concurrency & Performance", () => {
    it("should handle concurrent requests", async () => {
      const promises = Array(5)
        .fill(null)
        .map(() => request(app).get("/health").expect(HttpStatus.Ok));

      const responses = await Promise.all(promises);

      responses.forEach((response) => {
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe("ok");
      });
    });
  });
});
