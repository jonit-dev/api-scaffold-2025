import { describe, it, expect, beforeEach, vi } from "vitest";
import { Container } from "typedi";
import { UserRepository } from "../../../src/repositories/user.repository";
import { UserRole, UserStatus } from "../../../src/models/enums";
import { IUserEntity } from "../../../src/models/entities/user.entity";
import { DatabaseException } from "../../../src/exceptions/database.exception";
import { TestHelpers } from "../../utils/test.helpers";
import { AuthFactory } from "../../factories/auth.factory";

describe("UserRepository", () => {
  let userRepository: UserRepository;
  let mockSupabase: any;

  beforeEach(() => {
    TestHelpers.resetAllMocks();
    mockSupabase = TestHelpers.createMockSupabaseClient();
    Container.set("supabase", mockSupabase);

    // Create the repository with the mock client directly
    userRepository = new UserRepository(mockSupabase);
  });

  describe("findByEmail", () => {
    it("should find user by email successfully", async () => {
      const testUser = AuthFactory.createTestUser();
      mockSupabase.from().select().eq().eq().single.mockResolvedValue({
        data: testUser,
        error: null,
      });

      const result = await userRepository.findByEmail("test@example.com");

      expect(result).toEqual(testUser);
      expect(mockSupabase.from).toHaveBeenCalledWith("users");
      expect(mockSupabase.from().eq).toHaveBeenCalledWith(
        "email",
        "test@example.com"
      );
      expect(mockSupabase.from().eq).toHaveBeenCalledWith("deleted_at", null);
    });

    it("should return null when user not found", async () => {
      mockSupabase
        .from()
        .select()
        .eq()
        .eq()
        .single.mockResolvedValue({
          data: null,
          error: { code: "PGRST116", message: "No rows found" },
        });

      const result = await userRepository.findByEmail(
        "nonexistent@example.com"
      );

      expect(result).toBeNull();
    });

    it("should throw DatabaseException on database error", async () => {
      mockSupabase
        .from()
        .select()
        .eq()
        .eq()
        .single.mockResolvedValue({
          data: null,
          error: { code: "OTHER_ERROR", message: "Database error" },
        });

      await expect(
        userRepository.findByEmail("test@example.com")
      ).rejects.toThrow(DatabaseException);
    });
  });

  describe("findUsersPaginated", () => {
    it("should return paginated users successfully", async () => {
      const testUsers = [
        AuthFactory.createTestUser(),
        AuthFactory.createAdminUser(),
      ];
      mockSupabase.from().select().eq().range().order.mockResolvedValue({
        data: testUsers,
        error: null,
        count: 2,
      });

      const result = await userRepository.findUsersPaginated(1, 10);

      expect(result.data).toEqual(testUsers);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrevious).toBe(false);
    });

    it("should apply role filter correctly", async () => {
      const adminUser = AuthFactory.createAdminUser();
      mockSupabase
        .from()
        .select()
        .eq()
        .eq()
        .range()
        .order.mockResolvedValue({
          data: [adminUser],
          error: null,
          count: 1,
        });

      const result = await userRepository.findUsersPaginated(1, 10, {
        role: UserRole.ADMIN,
      });

      expect(mockSupabase.from().eq).toHaveBeenCalledWith(
        "role",
        UserRole.ADMIN
      );
      expect(result.data).toEqual([adminUser]);
    });

    it("should apply search filter correctly", async () => {
      const testUser = AuthFactory.createTestUser();
      mockSupabase
        .from()
        .select()
        .eq()
        .or()
        .range()
        .order.mockResolvedValue({
          data: [testUser],
          error: null,
          count: 1,
        });

      const result = await userRepository.findUsersPaginated(1, 10, {
        search: "Test",
      });

      expect(mockSupabase.from().or).toHaveBeenCalledWith(
        "first_name.ilike.%Test%,last_name.ilike.%Test%,email.ilike.%Test%"
      );
      expect(result.data).toEqual([testUser]);
    });

    it("should handle pagination correctly", async () => {
      const testUsers = [AuthFactory.createTestUser()];
      mockSupabase.from().select().eq().range().order.mockResolvedValue({
        data: testUsers,
        error: null,
        count: 25,
      });

      const result = await userRepository.findUsersPaginated(2, 10);

      expect(mockSupabase.from().range).toHaveBeenCalledWith(10, 19);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrevious).toBe(true);
    });

    it("should throw DatabaseException on error", async () => {
      mockSupabase
        .from()
        .select()
        .eq()
        .range()
        .order.mockResolvedValue({
          data: null,
          error: { message: "Database error" },
          count: null,
        });

      await expect(userRepository.findUsersPaginated(1, 10)).rejects.toThrow(
        DatabaseException
      );
    });
  });

  describe("isEmailUnique", () => {
    it("should return true when email is unique", async () => {
      // Setup the final promise resolution for the query chain
      const finalPromise = Promise.resolve({
        data: [],
        error: null,
      });

      // Mock the full chain to return the final promise
      mockSupabase.from().select().eq().eq.mockReturnValue(finalPromise);

      const result = await userRepository.isEmailUnique("unique@example.com");

      expect(result).toBe(true);
    });

    it("should return false when email exists", async () => {
      const finalPromise = Promise.resolve({
        data: [{ id: "existing-id" }],
        error: null,
      });

      mockSupabase.from().select().eq().eq.mockReturnValue(finalPromise);

      const result = await userRepository.isEmailUnique("existing@example.com");

      expect(result).toBe(false);
    });

    it("should exclude specific user ID when checking uniqueness", async () => {
      const finalPromise = Promise.resolve({
        data: [],
        error: null,
      });

      mockSupabase.from().select().eq().eq().neq.mockReturnValue(finalPromise);

      const result = await userRepository.isEmailUnique(
        "test@example.com",
        "user-id-123"
      );

      expect(mockSupabase.from().neq).toHaveBeenCalledWith("id", "user-id-123");
      expect(result).toBe(true);
    });

    it("should throw DatabaseException on error", async () => {
      const finalPromise = Promise.resolve({
        data: null,
        error: { message: "Database error" },
      });

      mockSupabase.from().select().eq().eq.mockReturnValue(finalPromise);

      await expect(
        userRepository.isEmailUnique("test@example.com")
      ).rejects.toThrow(DatabaseException);
    });
  });

  describe("updateLastLogin", () => {
    it("should update last login timestamp successfully", async () => {
      mockSupabase.from().update().eq.mockResolvedValue({
        error: null,
      });

      await userRepository.updateLastLogin("user-id-123");

      expect(mockSupabase.from).toHaveBeenCalledWith("users");
      expect(mockSupabase.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          last_login: expect.any(String),
          updated_at: expect.any(String),
        })
      );
      expect(mockSupabase.from().eq).toHaveBeenCalledWith("id", "user-id-123");
    });

    it("should throw DatabaseException on error", async () => {
      mockSupabase
        .from()
        .update()
        .eq.mockResolvedValue({
          error: { message: "Update failed" },
        });

      await expect(
        userRepository.updateLastLogin("user-id-123")
      ).rejects.toThrow(DatabaseException);
    });
  });

  describe("softDelete", () => {
    it("should soft delete user successfully", async () => {
      mockSupabase.from().update().eq.mockResolvedValue({
        error: null,
      });

      await userRepository.softDelete("user-id-123");

      expect(mockSupabase.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          deleted_at: expect.any(String),
          updated_at: expect.any(String),
        })
      );
      expect(mockSupabase.from().eq).toHaveBeenCalledWith("id", "user-id-123");
    });

    it("should throw DatabaseException on error", async () => {
      mockSupabase
        .from()
        .update()
        .eq.mockResolvedValue({
          error: { message: "Delete failed" },
        });

      await expect(userRepository.softDelete("user-id-123")).rejects.toThrow(
        DatabaseException
      );
    });
  });

  describe("findByRole", () => {
    it("should find users by role successfully", async () => {
      const adminUsers = [AuthFactory.createAdminUser()];
      mockSupabase.from().select().eq().eq().order.mockResolvedValue({
        data: adminUsers,
        error: null,
      });

      const result = await userRepository.findByRole(UserRole.ADMIN);

      expect(result).toEqual(adminUsers);
      expect(mockSupabase.from().eq).toHaveBeenCalledWith(
        "role",
        UserRole.ADMIN
      );
    });

    it("should throw DatabaseException on error", async () => {
      mockSupabase
        .from()
        .select()
        .eq()
        .eq()
        .order.mockResolvedValue({
          data: null,
          error: { message: "Query failed" },
        });

      await expect(userRepository.findByRole(UserRole.ADMIN)).rejects.toThrow(
        DatabaseException
      );
    });
  });

  describe("countByStatus", () => {
    it("should count users by status successfully", async () => {
      const finalPromise = Promise.resolve({
        count: 5,
        error: null,
      });

      mockSupabase.from().select().eq().eq.mockReturnValue(finalPromise);

      const result = await userRepository.countByStatus(UserStatus.ACTIVE);

      expect(result).toBe(5);
      expect(mockSupabase.from().eq).toHaveBeenCalledWith(
        "status",
        UserStatus.ACTIVE
      );
    });

    it("should return 0 when count is null", async () => {
      const finalPromise = Promise.resolve({
        count: null,
        error: null,
      });

      mockSupabase.from().select().eq().eq.mockReturnValue(finalPromise);

      const result = await userRepository.countByStatus(UserStatus.ACTIVE);

      expect(result).toBe(0);
    });

    it("should throw DatabaseException on error", async () => {
      const finalPromise = Promise.resolve({
        count: null,
        error: { message: "Count failed" },
      });

      mockSupabase.from().select().eq().eq.mockReturnValue(finalPromise);

      await expect(
        userRepository.countByStatus(UserStatus.ACTIVE)
      ).rejects.toThrow(DatabaseException);
    });
  });

  describe("updateEmailVerification", () => {
    it("should update email verification status successfully", async () => {
      mockSupabase.from().update().eq.mockResolvedValue({
        error: null,
      });

      await userRepository.updateEmailVerification("user-id-123", true);

      expect(mockSupabase.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          email_verified: true,
          updated_at: expect.any(String),
        })
      );
      expect(mockSupabase.from().eq).toHaveBeenCalledWith("id", "user-id-123");
    });

    it("should throw DatabaseException on error", async () => {
      mockSupabase
        .from()
        .update()
        .eq.mockResolvedValue({
          error: { message: "Update failed" },
        });

      await expect(
        userRepository.updateEmailVerification("user-id-123", true)
      ).rejects.toThrow(DatabaseException);
    });
  });

  describe("findUnverifiedUsers", () => {
    it("should find unverified users older than specified days", async () => {
      const unverifiedUsers = [AuthFactory.createUnverifiedUser()];
      mockSupabase.from().select().eq().eq().lt().order.mockResolvedValue({
        data: unverifiedUsers,
        error: null,
      });

      const result = await userRepository.findUnverifiedUsers(7);

      expect(result).toEqual(unverifiedUsers);
      expect(mockSupabase.from().eq).toHaveBeenCalledWith(
        "email_verified",
        false
      );
      expect(mockSupabase.from().lt).toHaveBeenCalledWith(
        "created_at",
        expect.any(String)
      );
    });

    it("should use default 7 days when no parameter provided", async () => {
      mockSupabase.from().select().eq().eq().lt().order.mockResolvedValue({
        data: [],
        error: null,
      });

      await userRepository.findUnverifiedUsers();

      expect(mockSupabase.from().lt).toHaveBeenCalledWith(
        "created_at",
        expect.any(String)
      );
    });

    it("should throw DatabaseException on error", async () => {
      mockSupabase
        .from()
        .select()
        .eq()
        .eq()
        .lt()
        .order.mockResolvedValue({
          data: null,
          error: { message: "Query failed" },
        });

      await expect(userRepository.findUnverifiedUsers(7)).rejects.toThrow(
        DatabaseException
      );
    });
  });
});
