import { UserRole } from "@models/enums/user-roles.enum";
import { UserStatus } from "@models/enums/user-status.enum";
import { IUserEntity } from "@models/entities/user.entity";
import { LoginDto } from "@models/dtos/auth/login.dto";
import { RegisterDto } from "@models/dtos/auth/register.dto";
import { AuthResponseDto } from "@models/dtos/auth/auth-response.dto";
import { UserResponseDto } from "@models/dtos/user/user-response.dto";
import { ISession } from "../../src/models/dtos/auth/auth-response.dto";
import { IAuthenticatedUser } from "@common-types/express";
import jwt from "jsonwebtoken";
import { vi } from "vitest";

export class AuthFactory {
  static createTestUser(overrides?: Partial<IUserEntity>): IUserEntity {
    const now = new Date().toISOString();
    return {
      id: "test-user-id-123",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      passwordHash: "hashed_password_123",
      role: UserRole.User,
      status: UserStatus.Active,
      emailVerified: true,
      phone: "+1234567890",
      avatarUrl: "https://example.com/avatar.jpg",
      lastLogin: now,
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
      ...overrides,
    };
  }

  static createAdminUser(overrides?: Partial<IUserEntity>): IUserEntity {
    return this.createTestUser({
      id: "admin-user-id-123",
      email: "admin@example.com",
      firstName: "Admin",
      lastName: "User",
      role: UserRole.Admin,
      ...overrides,
    });
  }

  static createModeratorUser(overrides?: Partial<IUserEntity>): IUserEntity {
    return this.createTestUser({
      id: "moderator-user-id-123",
      email: "moderator@example.com",
      firstName: "Moderator",
      lastName: "User",
      role: UserRole.Moderator,
      ...overrides,
    });
  }

  static createSuspendedUser(overrides?: Partial<IUserEntity>): IUserEntity {
    return this.createTestUser({
      id: "suspended-user-id-123",
      email: "suspended@example.com",
      status: UserStatus.Suspended,
      ...overrides,
    });
  }

  static createUnverifiedUser(overrides?: Partial<IUserEntity>): IUserEntity {
    return this.createTestUser({
      id: "unverified-user-id-123",
      email: "unverified@example.com",
      status: UserStatus.PendingVerification,
      emailVerified: false,
      ...overrides,
    });
  }

  static createLoginDto(overrides?: Partial<LoginDto>): LoginDto {
    return {
      email: "test@example.com",
      password: "Password123!",
      ...overrides,
    };
  }

  static createRegisterDto(overrides?: Partial<RegisterDto>): RegisterDto {
    return {
      email: "newuser@example.com",
      firstName: "New",
      lastName: "User",
      password: "Password123!",
      confirmPassword: "Password123!",
      ...overrides,
    };
  }

  static createSupabaseUser(overrides?: Partial<any>): any {
    return {
      id: "test-user-id-123",
      aud: "authenticated",
      role: "authenticated",
      email: "test@example.com",
      email_confirmed_at: new Date().toISOString(),
      phone: "+1234567890",
      confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: {
        firstName: "Test",
        lastName: "User",
      },
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  static createSession(overrides?: Partial<ISession>): ISession {
    const now = Date.now();
    return {
      access_token: "test-access-token-123",
      token_type: "Bearer",
      expires_in: 3600,
      expires_at: now + 3600000,
      refresh_token: "test-refresh-token-123",
      user: this.createSupabaseUser(),
      ...overrides,
    };
  }

  static createAuthenticatedUser(
    overrides?: Partial<IAuthenticatedUser>,
  ): IAuthenticatedUser {
    return {
      id: "test-user-id-123",
      email: "test@example.com",
      role: UserRole.User,
      ...overrides,
    };
  }

  static createAuthResponseDto(
    overrides?: Partial<AuthResponseDto>,
  ): AuthResponseDto {
    return {
      user: {
        id: "test-user-id-123",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        role: UserRole.User,
        status: UserStatus.Active,
        emailVerified: true,
        phone: "+1234567890",
        avatarUrl: "https://example.com/avatar.jpg",
        lastLogin: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        fullName: "Test User",
        passwordHash: "hashed_password_123",
      },
      session: this.createSession(),
      ...overrides,
    };
  }

  static createValidJwtToken(user?: Partial<IUserEntity>): string {
    // Generate a real JWT token for testing
    const testUser = user || this.createTestUser();

    return jwt.sign(
      {
        sub: testUser.id,
        email: testUser.email,
        role: testUser.role,
        type: "access",
      },
      process.env.JWT_SECRET || "test-jwt-secret-key-for-testing-only",
      { expiresIn: "1h" },
    );
  }

  static createExpiredJwtToken(): string {
    // This is a mock expired JWT token for testing
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQtMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiYXVkIjoiYXV0aGVudGljYXRlZCIsImV4cCI6MTYwMDAwMDAwMCwiaWF0IjoxNjAwMDAwMDAwLCJpc3MiOiJzdXBhYmFzZSJ9.test-signature";
  }

  static createInvalidJwtToken(): string {
    return "invalid.jwt.token";
  }

  static createMockSupabaseAuthResponse(
    user?: any | null,
    error?: any,
  ): { data: { user: any | null }; error: any } {
    return {
      data: { user: user || null },
      error: error || null,
    };
  }

  static createMockAuthRequest(user?: IAuthenticatedUser): any {
    return {
      headers: {
        authorization: user
          ? `Bearer ${this.createValidJwtToken()}`
          : undefined,
      },
      user: user || undefined,
    };
  }

  static createMockResponse(): any {
    return {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  }

  static createMockNext(): any {
    return vi.fn();
  }

  static createTestUserResponse(overrides?: Partial<any>): any {
    const now = new Date();
    return {
      id: "test-user-id-123",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      role: UserRole.User,
      status: UserStatus.Active,
      emailVerified: true,
      phone: "+1234567890",
      avatarUrl: "https://example.com/avatar.jpg",
      lastLogin: now,
      createdAt: now,
      updatedAt: now,
      fullName: "Test User",
      ...overrides,
    };
  }

  static createUserResponseDto(user?: Partial<IUserEntity>): UserResponseDto {
    const userData = user || this.createTestUser();
    const dto = new UserResponseDto();
    dto.id = userData.id!;
    dto.email = userData.email!;
    dto.firstName = userData.firstName!;
    dto.lastName = userData.lastName!;
    dto.role = userData.role!;
    dto.status = userData.status!;
    dto.emailVerified = userData.emailVerified!;
    dto.phone = userData.phone || undefined;
    dto.avatarUrl = userData.avatarUrl || undefined;
    dto.lastLogin = userData.lastLogin
      ? new Date(userData.lastLogin)
      : undefined;
    dto.createdAt = userData.createdAt
      ? new Date(userData.createdAt)
      : new Date();
    dto.updatedAt = userData.updatedAt
      ? new Date(userData.updatedAt)
      : new Date();
    return dto;
  }
}
