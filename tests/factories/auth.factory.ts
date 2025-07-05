import { UserRole } from "@models/enums/user-roles.enum";
import { UserStatus } from "@models/enums/user-status.enum";
import { IUserEntity } from "@models/entities/user.entity";
import { LoginDto } from "@models/dtos/auth/login.dto";
import { RegisterDto } from "@models/dtos/auth/register.dto";
import { AuthResponseDto } from "@models/dtos/auth/auth-response.dto";
import { User, Session } from "@supabase/supabase-js";
import { IAuthenticatedUser } from "@common-types/express";
import { vi } from "vitest";

export class AuthFactory {
  static createTestUser(overrides?: Partial<IUserEntity>): IUserEntity {
    const now = new Date().toISOString();
    return {
      id: "test-user-id-123",
      email: "test@example.com",
      first_name: "Test",
      last_name: "User",
      password_hash: "hashed_password_123",
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      email_verified: true,
      phone: "+1234567890",
      avatar_url: "https://example.com/avatar.jpg",
      last_login: now,
      created_at: now,
      updated_at: now,
      get full_name() {
        return `${this.first_name} ${this.last_name}`;
      },
      isActive() {
        return this.status === UserStatus.ACTIVE;
      },
      isAdmin() {
        return this.role === UserRole.ADMIN;
      },
      isModerator() {
        return this.role === UserRole.MODERATOR;
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
      first_name: "Admin",
      last_name: "User",
      role: UserRole.ADMIN,
      ...overrides,
    });
  }

  static createModeratorUser(overrides?: Partial<IUserEntity>): IUserEntity {
    return this.createTestUser({
      id: "moderator-user-id-123",
      email: "moderator@example.com",
      first_name: "Moderator",
      last_name: "User",
      role: UserRole.MODERATOR,
      ...overrides,
    });
  }

  static createSuspendedUser(overrides?: Partial<IUserEntity>): IUserEntity {
    return this.createTestUser({
      id: "suspended-user-id-123",
      email: "suspended@example.com",
      status: UserStatus.SUSPENDED,
      ...overrides,
    });
  }

  static createUnverifiedUser(overrides?: Partial<IUserEntity>): IUserEntity {
    return this.createTestUser({
      id: "unverified-user-id-123",
      email: "unverified@example.com",
      status: UserStatus.PENDING_VERIFICATION,
      email_verified: false,
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
      first_name: "New",
      last_name: "User",
      password: "Password123!",
      confirmPassword: "Password123!",
      ...overrides,
    };
  }

  static createSupabaseUser(overrides?: Partial<User>): User {
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
        first_name: "Test",
        last_name: "User",
      },
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  static createSupabaseSession(overrides?: Partial<Session>): Session {
    const now = Math.floor(Date.now() / 1000);
    return {
      access_token: "test-access-token-123",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: now + 3600,
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
      role: UserRole.USER,
      supabaseUser: this.createSupabaseUser(),
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
        first_name: "Test",
        last_name: "User",
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        email_verified: true,
        phone: "+1234567890",
        avatar_url: "https://example.com/avatar.jpg",
        last_login: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
        full_name: "Test User",
        password_hash: "hashed_password_123",
      },
      session: this.createSupabaseSession(),
      ...overrides,
    };
  }

  static createValidJwtToken(): string {
    // This is a mock JWT token for testing
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQtMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiYXVkIjoiYXV0aGVudGljYXRlZCIsImV4cCI6OTk5OTk5OTk5OSwiaWF0IjoxNjAwMDAwMDAwLCJpc3MiOiJzdXBhYmFzZSJ9.test-signature";
  }

  static createExpiredJwtToken(): string {
    // This is a mock expired JWT token for testing
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQtMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiYXVkIjoiYXV0aGVudGljYXRlZCIsImV4cCI6MTYwMDAwMDAwMCwiaWF0IjoxNjAwMDAwMDAwLCJpc3MiOiJzdXBhYmFzZSJ9.test-signature";
  }

  static createInvalidJwtToken(): string {
    return "invalid.jwt.token";
  }

  static createMockSupabaseAuthResponse(
    user?: User | null,
    error?: any,
  ): { data: { user: User | null }; error: any } {
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
}
