import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AuthService } from "../auth.service";
import { UserRepository } from "../../repositories/user.repository";
import { SQLiteConfig } from "../../config/sqlite";
import { config } from "../../config/env";
import { RegisterDto } from "../../models/dtos/auth/register.dto";
import { LoginDto } from "../../models/dtos/auth/login.dto";
import { UserRole } from "../../models/enums/user-roles.enum";
import { UserStatus } from "../../models/enums/user-status.enum";
import { IUserEntity } from "../../models/entities/user.entity";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";

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

describe("AuthService - SQLite Integration", () => {
  let authService: AuthService;
  let userRepository: UserRepository;
  let db: Database.Database;

  beforeEach(async () => {
    // Create in-memory SQLite database for testing
    db = new Database(":memory:");

    // Mock SQLiteConfig to return our test database
    vi.spyOn(SQLiteConfig, "getClient").mockReturnValue(db);

    // Initialize services
    userRepository = new UserRepository();
    authService = new AuthService(userRepository);

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
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });

  describe("register", () => {
    it("should register a new user with SQLite", async () => {
      const registerDto: RegisterDto = {
        email: "test@example.com",
        password: "Password123@",
        confirmPassword: "Password123@",
        firstName: "Test",
        lastName: "User",
      };

      const result = await authService.register(registerDto);

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(registerDto.email);
      expect(result.user.firstName).toBe(registerDto.firstName);
      expect(result.user.lastName).toBe(registerDto.lastName);
      expect(result.session).toBeDefined();
      expect(result.session!.access_token).toBeDefined();
      expect(result.session!.refresh_token).toBeDefined();

      // Verify user was saved to database
      const savedUser = await userRepository.findByEmail(registerDto.email);
      expect(savedUser).toBeDefined();
      expect(savedUser!.email).toBe(registerDto.email);
      expect(savedUser!.role).toBe(UserRole.User);
      expect(savedUser!.status).toBe(UserStatus.Active);
    });

    it("should hash the password correctly", async () => {
      const registerDto: RegisterDto = {
        email: "test2@example.com",
        password: "Password123@",
        confirmPassword: "Password123@",
        firstName: "Test",
        lastName: "User",
      };

      await authService.register(registerDto);

      const savedUser = await userRepository.findByEmail(registerDto.email);
      expect(savedUser!.passwordHash).toBeDefined();
      expect(savedUser!.passwordHash).not.toBe(registerDto.password);

      // Verify password can be verified
      const isValidPassword = await bcrypt.compare(
        registerDto.password,
        savedUser!.passwordHash!,
      );
      expect(isValidPassword).toBe(true);
    });

    it("should reject registration with mismatched passwords", async () => {
      const registerDto: RegisterDto = {
        email: "test3@example.com",
        password: "Password123@",
        confirmPassword: "DifferentPassword123@",
        firstName: "Test",
        lastName: "User",
      };

      await expect(authService.register(registerDto)).rejects.toThrow(
        "Passwords do not match",
      );
    });

    it("should reject registration with existing email", async () => {
      const registerDto: RegisterDto = {
        email: "duplicate@example.com",
        password: "Password123@",
        confirmPassword: "Password123@",
        firstName: "Test",
        lastName: "User",
      };

      await authService.register(registerDto);

      // Try to register again with same email
      await expect(authService.register(registerDto)).rejects.toThrow(
        "Email already registered",
      );
    });
  });

  describe("login", () => {
    let testUser: IUserEntity;

    beforeEach(async () => {
      // Create a test user
      const registerDto: RegisterDto = {
        email: "login@example.com",
        password: "Password123@",
        confirmPassword: "Password123@",
        firstName: "Login",
        lastName: "Test",
      };

      const result = await authService.register(registerDto);
      testUser = (await userRepository.findByEmail(
        registerDto.email,
      )) as IUserEntity;
    });

    it("should login with correct credentials", async () => {
      const loginDto: LoginDto = {
        email: "login@example.com",
        password: "Password123@",
      };

      const result = await authService.login(loginDto);

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(loginDto.email);
      expect(result.session).toBeDefined();
      expect(result.session!.access_token).toBeDefined();
      expect(result.session!.refresh_token).toBeDefined();
    });

    it("should reject login with incorrect password", async () => {
      const loginDto: LoginDto = {
        email: "login@example.com",
        password: "WrongPassword123@",
      };

      await expect(authService.login(loginDto)).rejects.toThrow(
        "Invalid email or password",
      );
    });

    it("should reject login with non-existent email", async () => {
      const loginDto: LoginDto = {
        email: "nonexistent@example.com",
        password: "Password123@",
      };

      await expect(authService.login(loginDto)).rejects.toThrow(
        "Invalid email or password",
      );
    });

    it("should update last login timestamp", async () => {
      const loginDto: LoginDto = {
        email: "login@example.com",
        password: "Password123@",
      };

      const beforeLogin = new Date();
      await authService.login(loginDto);

      const updatedUser = await userRepository.findByEmail(loginDto.email);
      expect(updatedUser!.lastLogin).toBeDefined();

      const lastLoginDate = new Date(updatedUser!.lastLogin!);
      expect(lastLoginDate.getTime()).toBeGreaterThanOrEqual(
        beforeLogin.getTime(),
      );
    });
  });

  describe("verifyUser", () => {
    let testUser: IUserEntity;
    let accessToken: string;

    beforeEach(async () => {
      // Create a test user and login to get token
      const registerDto: RegisterDto = {
        email: "verify@example.com",
        password: "Password123@",
        confirmPassword: "Password123@",
        firstName: "Verify",
        lastName: "Test",
      };

      const registerResult = await authService.register(registerDto);
      accessToken = registerResult.session!.access_token;
      testUser = (await userRepository.findByEmail(
        registerDto.email,
      )) as IUserEntity;
    });

    it("should verify valid JWT token", async () => {
      const verifiedUser = await authService.verifyUser(accessToken);

      expect(verifiedUser).toBeDefined();
      expect(verifiedUser.id).toBe(testUser.id);
      expect(verifiedUser.email).toBe(testUser.email);
    });

    it("should reject invalid JWT token", async () => {
      const invalidToken = "invalid.jwt.token";

      await expect(authService.verifyUser(invalidToken)).rejects.toThrow(
        "Invalid token",
      );
    });

    it("should reject expired JWT token", async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        {
          id: testUser.id,
          email: testUser.email,
          role: testUser.role,
        },
        config.auth.jwtSecret,
        { expiresIn: "-1h" }, // Expired 1 hour ago
      );

      await expect(authService.verifyUser(expiredToken)).rejects.toThrow(
        /Token expired|Invalid token/,
      );
    });

    it("should reject token for non-existent user", async () => {
      const tokenForNonExistentUser = jwt.sign(
        {
          id: "non-existent-id",
          email: "nonexistent@example.com",
          role: UserRole.User,
        },
        config.auth.jwtSecret,
        { expiresIn: "1h" },
      );

      await expect(
        authService.verifyUser(tokenForNonExistentUser),
      ).rejects.toThrow("User profile not found");
    });

    it("should reject token for suspended user", async () => {
      // Update user status to suspended
      await userRepository.update(testUser.id, {
        status: UserStatus.Suspended,
      });

      await expect(authService.verifyUser(accessToken)).rejects.toThrow(
        "Account is suspended",
      );
    });

    it("should reject token for inactive user", async () => {
      // Update user status to inactive
      await userRepository.update(testUser.id, { status: UserStatus.Inactive });

      await expect(authService.verifyUser(accessToken)).rejects.toThrow(
        "Account is inactive",
      );
    });
  });

  describe("JWT token validation", () => {
    it("should generate valid JWT tokens with correct payload", async () => {
      const registerDto: RegisterDto = {
        email: "jwt@example.com",
        password: "Password123@",
        confirmPassword: "Password123@",
        firstName: "JWT",
        lastName: "Test",
      };

      const result = await authService.register(registerDto);
      const token = result.session!.access_token;

      // Decode and verify token
      const decoded = jwt.verify(token, config.auth.jwtSecret) as any;

      expect(decoded.id).toBeDefined();
      expect(decoded.email).toBe(registerDto.email);
      expect(decoded.role).toBe(UserRole.User);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    it("should generate refresh tokens", async () => {
      const registerDto: RegisterDto = {
        email: "refresh@example.com",
        password: "Password123@",
        confirmPassword: "Password123@",
        firstName: "Refresh",
        lastName: "Test",
      };

      const result = await authService.register(registerDto);
      const refreshToken = result.session!.refresh_token;

      // Decode and verify refresh token
      const decoded = jwt.verify(refreshToken, config.auth.jwtSecret) as any;

      expect(decoded.id).toBeDefined();
      expect(decoded.type).toBe("refresh");
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });
  });
});
