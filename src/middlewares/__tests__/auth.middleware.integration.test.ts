import { TestHelpers } from "@tests/utils/test.helpers";
import { AuthMiddleware } from "@middlewares/auth.middleware";
import { createRoleMiddleware } from "@middlewares/rbac.middleware";
import { UserRole } from "@models/enums/user-roles.enum";
import { UserRepository } from "@repositories/user.repository";
import { AuthService } from "@services/auth.service";
import express from "express";
import request from "supertest";
import { Container } from "typedi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthFactory } from "@tests/factories/auth.factory";

describe("Auth Middleware Integration Tests", () => {
  let app: express.Application;
  let mockAuthService: AuthService;
  let mockUserRepository: UserRepository;
  let mockSupabaseAuth: any;
  let authMiddleware: AuthMiddleware;

  beforeEach(async () => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Create mock services
    mockAuthService = TestHelpers.createMockService<AuthService>([
      "getUserProfile",
      "register",
      "login",
      "logout",
      "verifyUser",
    ]);

    mockUserRepository = TestHelpers.createMockRepository<UserRepository>([
      "findById",
      "findByEmail",
      "create",
    ]);

    // Create mock Supabase client
    mockSupabaseAuth = {
      auth: {
        getUser: vi.fn(),
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
      },
    };

    // Register mocks in container
    Container.set("supabaseAuth", mockSupabaseAuth);
    Container.set(AuthService, mockAuthService);
    Container.set(UserRepository, mockUserRepository);

    // Create AuthMiddleware instance
    authMiddleware = new AuthMiddleware(mockAuthService, mockSupabaseAuth);
    Container.set(AuthMiddleware, authMiddleware);

    // Set up test routes
    app.get("/public", (req, res) => {
      res.json({ message: "This is a public endpoint" });
    });

    app.get(
      "/protected",
      (_req, res, next) => {
        authMiddleware.use(_req, res, (error) => {
          if (error) {
            return res.status(error.httpCode || 401).json({
              name: error.name || "UnauthorizedException",
              message: error.message || "Authentication failed",
            });
          }
          next();
        });
      },
      (_req, res) => {
        res.json({ message: "This is a protected endpoint" });
      },
    );

    app.get(
      "/admin-only",
      (_req, res, next) => {
        authMiddleware.use(_req, res, (error) => {
          if (error) {
            return res.status(error.httpCode || 401).json({
              name: error.name || "UnauthorizedException",
              message: error.message || "Authentication failed",
            });
          }

          const roleMiddleware = createRoleMiddleware(UserRole.ADMIN);
          roleMiddleware.use(_req, res, (roleError) => {
            if (roleError) {
              return res.status(roleError.httpCode || 403).json({
                name: roleError.name || "ForbiddenException",
                message: roleError.message || "Insufficient permissions",
              });
            }
            next();
          });
        });
      },
      (_req, res) => {
        res.json({ message: "This is an admin-only endpoint" });
      },
    );

    app.get(
      "/moderator-or-admin",
      (_req, res, next) => {
        authMiddleware.use(_req, res, (error) => {
          if (error) {
            return res.status(error.httpCode || 401).json({
              name: error.name || "UnauthorizedException",
              message: error.message || "Authentication failed",
            });
          }

          const roleMiddleware = createRoleMiddleware(
            UserRole.MODERATOR,
            UserRole.ADMIN,
          );
          roleMiddleware.use(_req, res, (roleError) => {
            if (roleError) {
              return res.status(roleError.httpCode || 403).json({
                name: roleError.name || "ForbiddenException",
                message: roleError.message || "Insufficient permissions",
              });
            }
            next();
          });
        });
      },
      (_req, res) => {
        res.json({ message: "This endpoint requires moderator or admin role" });
      },
    );
  });

  afterEach(() => {
    Container.reset();
  });

  describe("Public endpoints", () => {
    it("should allow access to public endpoints without authentication", async () => {
      const response = await request(app).get("/public").expect(200);

      expect(response.body).toEqual({
        message: "This is a public endpoint",
      });
    });
  });

  describe("Protected endpoints", () => {
    it("should deny access to protected endpoints without token", async () => {
      const response = await request(app).get("/protected").expect(401);

      expect(response.body).toMatchObject({
        name: "UnauthorizedException",
        message: "Access token required",
      });
    });

    it("should deny access with invalid token format", async () => {
      const response = await request(app)
        .get("/protected")
        .set("Authorization", "InvalidTokenFormat")
        .expect(401);

      expect(response.body).toMatchObject({
        name: "UnauthorizedException",
        message: "Access token required",
      });
    });

    it("should deny access with invalid Bearer token", async () => {
      const invalidToken = AuthFactory.createInvalidJwtToken();

      mockSupabaseAuth.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Invalid token" },
      });

      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        name: "UnauthorizedException",
        message: "Invalid or expired token",
      });
    });

    it("should allow access with valid token and user profile", async () => {
      const validToken = AuthFactory.createValidJwtToken();
      const supabaseUser = AuthFactory.createSupabaseUser();
      const userProfile = AuthFactory.createTestUser();

      mockSupabaseAuth.auth.getUser.mockResolvedValue({
        data: { user: supabaseUser },
        error: null,
      });
      (mockAuthService.getUserProfile as any).mockResolvedValue(userProfile);

      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: "This is a protected endpoint",
      });
    });

    it("should deny access when user profile not found", async () => {
      const validToken = AuthFactory.createValidJwtToken();
      const supabaseUser = AuthFactory.createSupabaseUser();

      mockSupabaseAuth.auth.getUser.mockResolvedValue({
        data: { user: supabaseUser },
        error: null,
      });
      (mockAuthService.getUserProfile as any).mockRejectedValue(
        new Error("User profile not found"),
      );

      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${validToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        name: "UnauthorizedException",
        message: "Authentication failed",
      });
    });
  });

  describe("Role-based access control", () => {
    const setupValidAuth = (userRole: UserRole) => {
      const validToken = AuthFactory.createValidJwtToken();
      const supabaseUser = AuthFactory.createSupabaseUser();
      const userProfile = AuthFactory.createTestUser({ role: userRole });

      mockSupabaseAuth.auth.getUser.mockResolvedValue({
        data: { user: supabaseUser },
        error: null,
      });
      (mockAuthService.getUserProfile as any).mockResolvedValue(userProfile);

      return validToken;
    };

    it("should deny regular user access to admin-only endpoint", async () => {
      const token = setupValidAuth(UserRole.USER);

      const response = await request(app)
        .get("/admin-only")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);

      expect(response.body).toMatchObject({
        name: "ForbiddenException",
        message: "Insufficient permissions",
      });
    });

    it("should allow admin access to admin-only endpoint", async () => {
      const token = setupValidAuth(UserRole.ADMIN);

      const response = await request(app)
        .get("/admin-only")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        message: "This is an admin-only endpoint",
      });
    });

    it("should allow moderator access to moderator-or-admin endpoint", async () => {
      const token = setupValidAuth(UserRole.MODERATOR);

      const response = await request(app)
        .get("/moderator-or-admin")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        message: "This endpoint requires moderator or admin role",
      });
    });

    it("should allow admin access to moderator-or-admin endpoint", async () => {
      const token = setupValidAuth(UserRole.ADMIN);

      const response = await request(app)
        .get("/moderator-or-admin")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        message: "This endpoint requires moderator or admin role",
      });
    });

    it("should deny regular user access to moderator-or-admin endpoint", async () => {
      const token = setupValidAuth(UserRole.USER);

      const response = await request(app)
        .get("/moderator-or-admin")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);

      expect(response.body).toMatchObject({
        name: "ForbiddenException",
        message: "Insufficient permissions",
      });
    });
  });

  describe("Error handling", () => {
    it("should handle Supabase service errors gracefully", async () => {
      const validToken = AuthFactory.createValidJwtToken();

      mockSupabaseAuth.auth.getUser.mockRejectedValue(
        new Error("Supabase service unavailable"),
      );

      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${validToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        name: "UnauthorizedException",
        message: "Authentication failed",
      });
    });

    it("should handle auth service errors gracefully", async () => {
      const validToken = AuthFactory.createValidJwtToken();
      const supabaseUser = AuthFactory.createSupabaseUser();

      mockSupabaseAuth.auth.getUser.mockResolvedValue({
        data: { user: supabaseUser },
        error: null,
      });
      (mockAuthService.getUserProfile as any).mockRejectedValue(
        new Error("Database connection failed"),
      );

      const response = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${validToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        name: "UnauthorizedException",
        message: "Authentication failed",
      });
    });
  });
});
