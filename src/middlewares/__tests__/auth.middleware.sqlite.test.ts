import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { AuthMiddleware } from "../auth.middleware";
import { AuthService } from "../../services/auth.service";
import { UserRepository } from "../../repositories/user.repository";
import { SQLiteConfig } from "../../config/sqlite";
import { config } from "../../config/env";
import { UnauthorizedException } from "../../exceptions/http-exceptions";
import { IUserEntity } from "../../models/entities/user.entity";
import { UserRole } from "../../models/enums/user-roles.enum";
import { UserStatus } from "../../models/enums/user-status.enum";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";

// Mock the config to use SQLite
vi.mock("../../config/env", async () => {
  const actual = await vi.importActual("../../config/env");
  return {
    ...actual,
    config: {
      ...(actual as any).config,
      database: {
        provider: "sqlite",
      },
      auth: {
        jwtSecret: "test-secret-key",
        bcryptRounds: "10",
      },
    },
  };
});

describe("AuthMiddleware - SQLite Integration", () => {
  let authMiddleware: AuthMiddleware;
  let authService: AuthService;
  let userRepository: UserRepository;
  let db: Database.Database;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(async () => {
    // Create in-memory SQLite database for testing
    db = new Database(":memory:");

    // Mock SQLiteConfig to return our test database
    vi.spyOn(SQLiteConfig, "getClient").mockReturnValue(db);

    // Initialize services
    userRepository = new UserRepository();
    const mockEmailService = {
      sendWithTemplate: vi.fn().mockResolvedValue({ success: true }),
    } as any;
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    } as any;
    authService = new AuthService(userRepository, mockEmailService, mockLogger);
    authMiddleware = new AuthMiddleware(authService, {} as any);

    // Initialize the users table
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        first_name TEXT,
        last_name TEXT,
        password_hash TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        status TEXT NOT NULL DEFAULT 'active',
        email_verified BOOLEAN DEFAULT FALSE,
        phone TEXT,
        avatar_url TEXT,
        last_login TEXT,
        stripe_customer_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )
    `);

    // Setup mock request/response
    mockRequest = {
      headers: {},
      user: undefined,
    };
    mockResponse = {};
    mockNext = vi.fn();
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });

  describe("use", () => {
    let testUser: IUserEntity;
    let validToken: string;

    beforeEach(async () => {
      // Create a test user
      const now = new Date().toISOString();
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      testUser = {
        id: userId,
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        passwordHash: "hashed_password",
        role: UserRole.User,
        status: UserStatus.Active,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        get fullName() {
          return `${this.firstName} ${this.lastName}`;
        },
        isActive() {
          return this.status === UserStatus.Active;
        },
        isAdmin() {
          return this.role === UserRole.Admin;
        },
        isModerator() {
          return this.role === UserRole.Moderator;
        },
        hasRole(role: UserRole) {
          return this.role === role;
        },
        hasAnyRole(...roles: UserRole[]) {
          return roles.includes(this.role);
        },
      };

      // Insert user into database
      const stmt = db.prepare(`
        INSERT INTO users (id, email, first_name, last_name, password_hash, role, status, email_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        testUser.id,
        testUser.email,
        testUser.firstName,
        testUser.lastName,
        testUser.passwordHash,
        testUser.role,
        testUser.status,
        testUser.emailVerified ? 1 : 0,
        testUser.createdAt,
        testUser.updatedAt,
      );

      // Generate valid token
      validToken = jwt.sign(
        {
          id: testUser.id,
          email: testUser.email,
          role: testUser.role,
        },
        config.auth.jwtSecret,
        { expiresIn: "1h" },
      );
    });

    it("should authenticate user with valid Bearer token", async () => {
      mockRequest.headers = {
        authorization: `Bearer ${validToken}`,
      };

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user!.id).toBe(testUser.id);
      expect(mockRequest.user!.email).toBe(testUser.email);
      expect(mockRequest.user!.role).toBe(testUser.role);
    });

    it("should reject request without authorization header", async () => {
      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockRequest.user).toBeUndefined();
    });

    it("should reject request with invalid Bearer token format", async () => {
      mockRequest.headers = {
        authorization: "InvalidFormat token",
      };

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockRequest.user).toBeUndefined();
    });

    it("should reject request with invalid JWT token", async () => {
      mockRequest.headers = {
        authorization: "Bearer invalid.jwt.token",
      };

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockRequest.user).toBeUndefined();
    });

    it("should reject request with expired JWT token", async () => {
      const expiredToken = jwt.sign(
        {
          id: testUser.id,
          email: testUser.email,
          role: testUser.role,
        },
        config.auth.jwtSecret,
        { expiresIn: "-1h" }, // Expired 1 hour ago
      );

      mockRequest.headers = {
        authorization: `Bearer ${expiredToken}`,
      };

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockRequest.user).toBeUndefined();
    });

    it("should reject request for non-existent user", async () => {
      const tokenForNonExistentUser = jwt.sign(
        {
          id: "non-existent-id",
          email: "nonexistent@example.com",
          role: UserRole.User,
        },
        config.auth.jwtSecret,
        { expiresIn: "1h" },
      );

      mockRequest.headers = {
        authorization: `Bearer ${tokenForNonExistentUser}`,
      };

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockRequest.user).toBeUndefined();
    });

    it("should reject request for suspended user", async () => {
      // Update user status to suspended
      const updateStmt = db.prepare(
        "UPDATE users SET status = ?, updated_at = ? WHERE id = ?",
      );
      updateStmt.run(
        UserStatus.Suspended,
        new Date().toISOString(),
        testUser.id,
      );

      mockRequest.headers = {
        authorization: `Bearer ${validToken}`,
      };

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockRequest.user).toBeUndefined();
    });

    it("should reject request for inactive user", async () => {
      // Update user status to inactive
      const updateStmt = db.prepare(
        "UPDATE users SET status = ?, updated_at = ? WHERE id = ?",
      );
      updateStmt.run(
        UserStatus.Inactive,
        new Date().toISOString(),
        testUser.id,
      );

      mockRequest.headers = {
        authorization: `Bearer ${validToken}`,
      };

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedException));
      expect(mockRequest.user).toBeUndefined();
    });

    it("should handle case-insensitive Bearer token", async () => {
      mockRequest.headers = {
        authorization: `bearer ${validToken}`,
      };

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user!.id).toBe(testUser.id);
    });

    it("should handle authorization header with extra spaces", async () => {
      mockRequest.headers = {
        authorization: `  Bearer   ${validToken}  `,
      };

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user!.id).toBe(testUser.id);
    });

    it("should work with different user roles", async () => {
      // Create admin user
      const adminUser = {
        ...testUser,
        id: `admin_${Date.now()}`,
        email: "admin@example.com",
        role: UserRole.Admin,
      };

      const stmt = db.prepare(`
        INSERT INTO users (id, email, first_name, last_name, password_hash, role, status, email_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        adminUser.id,
        adminUser.email,
        adminUser.firstName,
        adminUser.lastName,
        adminUser.passwordHash,
        adminUser.role,
        adminUser.status,
        adminUser.emailVerified ? 1 : 0,
        adminUser.createdAt,
        adminUser.updatedAt,
      );

      const adminToken = jwt.sign(
        {
          id: adminUser.id,
          email: adminUser.email,
          role: adminUser.role,
        },
        config.auth.jwtSecret,
        { expiresIn: "1h" },
      );

      mockRequest.headers = {
        authorization: `Bearer ${adminToken}`,
      };

      await authMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user!.id).toBe(adminUser.id);
      expect(mockRequest.user!.role).toBe(UserRole.Admin);
    });
  });
});
