import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { app } from "@/app";
import { HttpStatus } from "@/types/http-status";
import { Container } from "typedi";
import { AuthService } from "@/services/auth.service";
import { UserService } from "@/services/user.service";
import { EmailService } from "@/services/email.service";
import { LoggerService } from "@/services/logger.service";

describe("Auth Controller Integration Tests", () => {
  beforeEach(() => {
    // Mock AuthService
    const mockAuthService = {
      register: vi.fn().mockResolvedValue({
        success: true,
        message: "User registered successfully",
        data: {
          user: {
            id: "user-123",
            email: "test@example.com",
            firstName: "Test",
            lastName: "User",
            role: "user",
            isEmailVerified: false,
          },
          tokens: {
            accessToken: "access-token-123",
            refreshToken: "refresh-token-123",
          },
        },
      }),
      login: vi.fn().mockResolvedValue({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: "user-123",
            email: "test@example.com",
            firstName: "Test",
            lastName: "User",
            role: "user",
            isEmailVerified: true,
          },
          tokens: {
            accessToken: "access-token-123",
            refreshToken: "refresh-token-123",
          },
        },
      }),
      refreshToken: vi.fn().mockResolvedValue({
        success: true,
        message: "Token refreshed successfully",
        data: {
          accessToken: "new-access-token-123",
          refreshToken: "new-refresh-token-123",
        },
      }),
      forgotPassword: vi.fn().mockResolvedValue({
        success: true,
        message: "Password reset email sent",
      }),
      resetPassword: vi.fn().mockResolvedValue({
        success: true,
        message: "Password reset successful",
      }),
      changePassword: vi.fn().mockResolvedValue({
        success: true,
        message: "Password changed successfully",
      }),
      verifyEmail: vi.fn().mockResolvedValue({
        success: true,
        message: "Email verified successfully",
      }),
      resendVerification: vi.fn().mockResolvedValue({
        success: true,
        message: "Verification email sent",
      }),
      logout: vi.fn().mockResolvedValue({
        success: true,
        message: "Logged out successfully",
      }),
      getProfile: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: "user-123",
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          role: "user",
          isEmailVerified: true,
        },
      }),
    };

    // Mock other services
    const mockUserService = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
    };

    const mockEmailService = {
      send: vi.fn().mockResolvedValue({ success: true, id: "email-123" }),
    };

    const mockLoggerService = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    // Register mocks
    Container.set(AuthService, mockAuthService);
    Container.set(UserService, mockUserService);
    Container.set(EmailService, mockEmailService);
    Container.set(LoggerService, mockLoggerService);
  });

  describe("POST /auth/register", () => {
    it("should register a new user successfully", async () => {
      const userData = {
        email: "newuser@example.com",
        password: "SecurePass123!",
        firstName: "New",
        lastName: "User",
      };

      const response = await request(app)
        .post("/auth/register")
        .send(userData)
        .expect(HttpStatus.Created);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("User registered successfully");
      expect(response.body.data.user.email).toBe("test@example.com");
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({})
        .expect(HttpStatus.BadRequest);

      expect(response.body.message).toContain("Validation failed");
    });

    it("should validate email format", async () => {
      const userData = {
        email: "invalid-email",
        password: "SecurePass123!",
        firstName: "Test",
        lastName: "User",
      };

      const response = await request(app)
        .post("/auth/register")
        .send(userData)
        .expect(HttpStatus.BadRequest);

      expect(response.body.message).toContain("Validation failed");
    });

    it("should validate password strength", async () => {
      const userData = {
        email: "test@example.com",
        password: "weak",
        firstName: "Test",
        lastName: "User",
      };

      const response = await request(app)
        .post("/auth/register")
        .send(userData)
        .expect(HttpStatus.BadRequest);

      expect(response.body.message).toContain("Validation failed");
    });
  });

  describe("POST /auth/login", () => {
    it("should login user successfully", async () => {
      const loginData = {
        email: "test@example.com",
        password: "SecurePass123!",
      };

      const response = await request(app)
        .post("/auth/login")
        .send(loginData)
        .expect(HttpStatus.Ok);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Login successful");
      expect(response.body.data.user.email).toBe("test@example.com");
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({})
        .expect(HttpStatus.BadRequest);

      expect(response.body.message).toContain("Validation failed");
    });

    it("should validate email format", async () => {
      const loginData = {
        email: "invalid-email",
        password: "password123",
      };

      const response = await request(app)
        .post("/auth/login")
        .send(loginData)
        .expect(HttpStatus.BadRequest);

      expect(response.body.message).toContain("Validation failed");
    });
  });

  describe("POST /auth/refresh", () => {
    it("should refresh tokens successfully", async () => {
      const refreshData = {
        refreshToken: "valid-refresh-token-123",
      };

      const response = await request(app)
        .post("/auth/refresh")
        .send(refreshData)
        .expect(HttpStatus.Ok);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Token refreshed successfully");
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it("should validate refresh token", async () => {
      const response = await request(app)
        .post("/auth/refresh")
        .send({})
        .expect(HttpStatus.BadRequest);

      expect(response.body.message).toContain("Validation failed");
    });
  });

  describe("POST /auth/forgot-password", () => {
    it("should send password reset email", async () => {
      const forgotData = {
        email: "test@example.com",
      };

      const response = await request(app)
        .post("/auth/forgot-password")
        .send(forgotData)
        .expect(HttpStatus.Ok);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Password reset email sent");
    });

    it("should validate email format", async () => {
      const forgotData = {
        email: "invalid-email",
      };

      const response = await request(app)
        .post("/auth/forgot-password")
        .send(forgotData)
        .expect(HttpStatus.BadRequest);

      expect(response.body.message).toContain("Validation failed");
    });
  });

  describe("POST /auth/reset-password", () => {
    it("should reset password successfully", async () => {
      const resetData = {
        token: "valid-reset-token",
        newPassword: "NewSecurePass123!",
      };

      const response = await request(app)
        .post("/auth/reset-password")
        .send(resetData)
        .expect(HttpStatus.Ok);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Password reset successful");
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post("/auth/reset-password")
        .send({})
        .expect(HttpStatus.BadRequest);

      expect(response.body.message).toContain("Validation failed");
    });
  });

  describe("POST /auth/change-password", () => {
    it("should change password successfully", async () => {
      const changeData = {
        currentPassword: "OldPass123!",
        newPassword: "NewPass123!",
      };

      const response = await request(app)
        .post("/auth/change-password")
        .set("Authorization", "Bearer valid-token")
        .send(changeData)
        .expect(HttpStatus.Ok);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Password changed successfully");
    });

    it("should require authentication", async () => {
      const changeData = {
        currentPassword: "OldPass123!",
        newPassword: "NewPass123!",
      };

      await request(app)
        .post("/auth/change-password")
        .send(changeData)
        .expect(HttpStatus.Unauthorized);
    });
  });

  describe("POST /auth/verify-email", () => {
    it("should verify email successfully", async () => {
      const verifyData = {
        token: "valid-verify-token",
      };

      const response = await request(app)
        .post("/auth/verify-email")
        .send(verifyData)
        .expect(HttpStatus.Ok);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Email verified successfully");
    });

    it("should validate token", async () => {
      const response = await request(app)
        .post("/auth/verify-email")
        .send({})
        .expect(HttpStatus.BadRequest);

      expect(response.body.message).toContain("Validation failed");
    });
  });

  describe("POST /auth/resend-verification", () => {
    it("should resend verification email", async () => {
      const resendData = {
        email: "test@example.com",
      };

      const response = await request(app)
        .post("/auth/resend-verification")
        .send(resendData)
        .expect(HttpStatus.Ok);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Verification email sent");
    });

    it("should validate email format", async () => {
      const resendData = {
        email: "invalid-email",
      };

      const response = await request(app)
        .post("/auth/resend-verification")
        .send(resendData)
        .expect(HttpStatus.BadRequest);

      expect(response.body.message).toContain("Validation failed");
    });
  });

  describe("POST /auth/logout", () => {
    it("should logout successfully", async () => {
      const response = await request(app)
        .post("/auth/logout")
        .set("Authorization", "Bearer valid-token")
        .expect(HttpStatus.Ok);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Logged out successfully");
    });

    it("should require authentication", async () => {
      await request(app).post("/auth/logout").expect(HttpStatus.Unauthorized);
    });
  });

  describe("GET /auth/profile", () => {
    it("should get user profile successfully", async () => {
      const response = await request(app)
        .get("/auth/profile")
        .set("Authorization", "Bearer valid-token")
        .expect(HttpStatus.Ok);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe("test@example.com");
      expect(response.body.data.firstName).toBe("Test");
      expect(response.body.data.lastName).toBe("User");
    });

    it("should require authentication", async () => {
      await request(app).get("/auth/profile").expect(HttpStatus.Unauthorized);
    });
  });

  describe("Rate Limiting", () => {
    it("should apply rate limiting to register endpoint", async () => {
      const userData = {
        email: "test@example.com",
        password: "SecurePass123!",
        firstName: "Test",
        lastName: "User",
      };

      // Make multiple requests quickly
      const requests = Array(6)
        .fill(null)
        .map(() => request(app).post("/auth/register").send(userData));

      const responses = await Promise.all(requests);

      // At least one should be rate limited (429)
      const rateLimitedResponses = responses.filter(
        (r) => r.status === HttpStatus.TooManyRequests,
      );
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it("should apply rate limiting to login endpoint", async () => {
      const loginData = {
        email: "test@example.com",
        password: "SecurePass123!",
      };

      // Make multiple requests quickly
      const requests = Array(6)
        .fill(null)
        .map(() => request(app).post("/auth/login").send(loginData));

      const responses = await Promise.all(requests);

      // At least one should be rate limited (429)
      const rateLimitedResponses = responses.filter(
        (r) => r.status === HttpStatus.TooManyRequests,
      );
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle service errors gracefully", async () => {
      // Mock service to throw error
      const authService = Container.get(AuthService) as any;
      authService.login.mockRejectedValue(
        new Error("Database connection failed"),
      );

      const loginData = {
        email: "test@example.com",
        password: "SecurePass123!",
      };

      const response = await request(app).post("/auth/login").send(loginData);

      expect([HttpStatus.InternalServerError, HttpStatus.BadRequest]).toContain(
        response.status,
      );
    });

    it("should validate malformed JSON", async () => {
      const response = await request(app)
        .post("/auth/login")
        .set("Content-Type", "application/json")
        .send('{"malformed": json}');

      expect([HttpStatus.BadRequest, HttpStatus.InternalServerError]).toContain(
        response.status,
      );
    });
  });
});
