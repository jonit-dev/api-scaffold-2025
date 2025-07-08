import { describe, it, expect, beforeEach, vi } from "vitest";
import { Container } from "typedi";
import { UserService } from "../user.service";
import { UserRepository } from "../../repositories/user.repository";
import { LoggerService } from "../logger.service";
import { CacheService } from "../cache.service";
import { UserRole } from "../../models/enums/user-roles.enum";
import { UserStatus } from "../../models/enums/user-status.enum";
import {
  BadRequest,
  NotFound,
  Conflict,
} from "../../exceptions/http-exceptions";

describe("UserService Tests", () => {
  let userService: UserService;

  beforeEach(() => {
    // Mock UserRepository
    const mockUserRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByEmail: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      softDelete: vi.fn(),
      restore: vi.fn(),
    };

    // Mock LoggerService
    const mockLoggerService = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    // Mock CacheService
    const mockCacheService = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
    };

    Container.set(UserRepository, mockUserRepository);
    Container.set(LoggerService, mockLoggerService);
    Container.set(CacheService, mockCacheService);

    userService = new UserService();
  });

  describe("createUser", () => {
    it("should create a new user successfully", async () => {
      const userData = {
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        password: "hashedPassword123",
        role: UserRole.User,
      };

      const createdUser = {
        id: "user-123",
        ...userData,
        status: UserStatus.Active,
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const userRepository = Container.get(UserRepository) as any;
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(createdUser);

      const result = await userService.createUser(userData);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(userData.email);
      expect(userRepository.create).toHaveBeenCalledWith(userData);
      expect(result).toEqual(createdUser);
    });

    it("should throw error if email already exists", async () => {
      const userData = {
        email: "existing@example.com",
        firstName: "Test",
        lastName: "User",
        password: "hashedPassword123",
        role: UserRole.User,
      };

      const existingUser = {
        id: "existing-user",
        email: userData.email,
        firstName: "Existing",
        lastName: "User",
      };

      const userRepository = Container.get(UserRepository) as any;
      userRepository.findByEmail.mockResolvedValue(existingUser);

      await expect(userService.createUser(userData)).rejects.toThrow(Conflict);
    });

    it("should validate required fields", async () => {
      const invalidUserData = {
        email: "",
        firstName: "",
        lastName: "",
        password: "",
        role: UserRole.User,
      };

      await expect(userService.createUser(invalidUserData)).rejects.toThrow(
        BadRequest,
      );
    });
  });

  describe("getUserById", () => {
    it("should return user by id from cache if available", async () => {
      const userId = "user-123";
      const cachedUser = {
        id: userId,
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
      };

      const cacheService = Container.get(CacheService) as any;
      cacheService.get.mockResolvedValue(cachedUser);

      const result = await userService.getUserById(userId);

      expect(cacheService.get).toHaveBeenCalledWith(`user:${userId}`);
      expect(result).toEqual(cachedUser);
    });

    it("should fetch user from database if not in cache", async () => {
      const userId = "user-123";
      const dbUser = {
        id: userId,
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        status: UserStatus.Active,
      };

      const cacheService = Container.get(CacheService) as any;
      const userRepository = Container.get(UserRepository) as any;

      cacheService.get.mockResolvedValue(null);
      userRepository.findById.mockResolvedValue(dbUser);

      const result = await userService.getUserById(userId);

      expect(userRepository.findById).toHaveBeenCalledWith(userId);
      expect(cacheService.set).toHaveBeenCalledWith(
        `user:${userId}`,
        dbUser,
        300,
      );
      expect(result).toEqual(dbUser);
    });

    it("should throw NotFound if user does not exist", async () => {
      const userId = "nonexistent-user";

      const cacheService = Container.get(CacheService) as any;
      const userRepository = Container.get(UserRepository) as any;

      cacheService.get.mockResolvedValue(null);
      userRepository.findById.mockResolvedValue(null);

      await expect(userService.getUserById(userId)).rejects.toThrow(NotFound);
    });
  });

  describe("getUserByEmail", () => {
    it("should return user by email", async () => {
      const email = "test@example.com";
      const user = {
        id: "user-123",
        email,
        firstName: "Test",
        lastName: "User",
      };

      const userRepository = Container.get(UserRepository) as any;
      userRepository.findByEmail.mockResolvedValue(user);

      const result = await userService.getUserByEmail(email);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(email);
      expect(result).toEqual(user);
    });

    it("should return null if user not found", async () => {
      const email = "nonexistent@example.com";

      const userRepository = Container.get(UserRepository) as any;
      userRepository.findByEmail.mockResolvedValue(null);

      const result = await userService.getUserByEmail(email);

      expect(result).toBeNull();
    });
  });

  describe("updateUser", () => {
    it("should update user successfully", async () => {
      const userId = "user-123";
      const updateData = {
        firstName: "Updated",
        lastName: "Name",
      };

      const existingUser = {
        id: userId,
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
      };

      const updatedUser = {
        ...existingUser,
        ...updateData,
        updatedAt: new Date(),
      };

      const userRepository = Container.get(UserRepository) as any;
      const cacheService = Container.get(CacheService) as any;

      userRepository.findById.mockResolvedValue(existingUser);
      userRepository.update.mockResolvedValue(updatedUser);

      const result = await userService.updateUser(userId, updateData);

      expect(userRepository.update).toHaveBeenCalledWith(userId, updateData);
      expect(cacheService.delete).toHaveBeenCalledWith(`user:${userId}`);
      expect(result).toEqual(updatedUser);
    });

    it("should throw NotFound if user does not exist", async () => {
      const userId = "nonexistent-user";
      const updateData = { firstName: "Updated" };

      const userRepository = Container.get(UserRepository) as any;
      userRepository.findById.mockResolvedValue(null);

      await expect(userService.updateUser(userId, updateData)).rejects.toThrow(
        NotFound,
      );
    });

    it("should throw Conflict if updating email to existing one", async () => {
      const userId = "user-123";
      const updateData = { email: "existing@example.com" };

      const existingUser = {
        id: userId,
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
      };

      const userWithSameEmail = {
        id: "other-user",
        email: updateData.email,
        firstName: "Other",
        lastName: "User",
      };

      const userRepository = Container.get(UserRepository) as any;
      userRepository.findById.mockResolvedValue(existingUser);
      userRepository.findByEmail.mockResolvedValue(userWithSameEmail);

      await expect(userService.updateUser(userId, updateData)).rejects.toThrow(
        Conflict,
      );
    });
  });

  describe("deleteUser", () => {
    it("should soft delete user successfully", async () => {
      const userId = "user-123";
      const existingUser = {
        id: userId,
        email: "test@example.com",
        status: UserStatus.Active,
      };

      const userRepository = Container.get(UserRepository) as any;
      const cacheService = Container.get(CacheService) as any;

      userRepository.findById.mockResolvedValue(existingUser);
      userRepository.softDelete.mockResolvedValue(true);

      const result = await userService.deleteUser(userId);

      expect(userRepository.softDelete).toHaveBeenCalledWith(userId);
      expect(cacheService.delete).toHaveBeenCalledWith(`user:${userId}`);
      expect(result).toBe(true);
    });

    it("should throw NotFound if user does not exist", async () => {
      const userId = "nonexistent-user";

      const userRepository = Container.get(UserRepository) as any;
      userRepository.findById.mockResolvedValue(null);

      await expect(userService.deleteUser(userId)).rejects.toThrow(NotFound);
    });
  });

  describe("getAllUsers", () => {
    it("should return paginated users", async () => {
      const page = 1;
      const limit = 10;
      const filters = { role: UserRole.User };

      const users = [
        {
          id: "user-1",
          email: "user1@example.com",
          firstName: "User",
          lastName: "One",
          role: UserRole.User,
        },
        {
          id: "user-2",
          email: "user2@example.com",
          firstName: "User",
          lastName: "Two",
          role: UserRole.User,
        },
      ];

      const totalCount = 25;

      const userRepository = Container.get(UserRepository) as any;
      userRepository.findMany.mockResolvedValue(users);
      userRepository.count.mockResolvedValue(totalCount);

      const result = await userService.getAllUsers(page, limit, filters);

      expect(userRepository.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: limit,
        where: filters,
        orderBy: { createdAt: "desc" },
      });
      expect(userRepository.count).toHaveBeenCalledWith(filters);
      expect(result).toEqual({
        users,
        totalCount,
        totalPages: 3,
        currentPage: page,
        hasNextPage: true,
        hasPreviousPage: false,
      });
    });

    it("should handle empty results", async () => {
      const page = 1;
      const limit = 10;

      const userRepository = Container.get(UserRepository) as any;
      userRepository.findMany.mockResolvedValue([]);
      userRepository.count.mockResolvedValue(0);

      const result = await userService.getAllUsers(page, limit);

      expect(result).toEqual({
        users: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: page,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });
  });

  describe("updateUserStatus", () => {
    it("should update user status successfully", async () => {
      const userId = "user-123";
      const newStatus = UserStatus.Suspended;

      const existingUser = {
        id: userId,
        email: "test@example.com",
        status: UserStatus.Active,
      };

      const updatedUser = {
        ...existingUser,
        status: newStatus,
        updatedAt: new Date(),
      };

      const userRepository = Container.get(UserRepository) as any;
      const cacheService = Container.get(CacheService) as any;

      userRepository.findById.mockResolvedValue(existingUser);
      userRepository.update.mockResolvedValue(updatedUser);

      const result = await userService.updateUserStatus(userId, newStatus);

      expect(userRepository.update).toHaveBeenCalledWith(userId, {
        status: newStatus,
      });
      expect(cacheService.delete).toHaveBeenCalledWith(`user:${userId}`);
      expect(result).toEqual(updatedUser);
    });

    it("should throw NotFound if user does not exist", async () => {
      const userId = "nonexistent-user";
      const newStatus = UserStatus.Suspended;

      const userRepository = Container.get(UserRepository) as any;
      userRepository.findById.mockResolvedValue(null);

      await expect(
        userService.updateUserStatus(userId, newStatus),
      ).rejects.toThrow(NotFound);
    });
  });

  describe("searchUsers", () => {
    it("should search users by query", async () => {
      const query = "john";
      const searchResults = [
        {
          id: "user-1",
          email: "john.doe@example.com",
          firstName: "John",
          lastName: "Doe",
        },
        {
          id: "user-2",
          email: "johnsmith@example.com",
          firstName: "John",
          lastName: "Smith",
        },
      ];

      const userRepository = Container.get(UserRepository) as any;
      userRepository.findMany.mockResolvedValue(searchResults);

      const result = await userService.searchUsers(query);

      expect(userRepository.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 50,
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual(searchResults);
    });

    it("should return empty array for no matches", async () => {
      const query = "nonexistent";

      const userRepository = Container.get(UserRepository) as any;
      userRepository.findMany.mockResolvedValue([]);

      const result = await userService.searchUsers(query);

      expect(result).toEqual([]);
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      const userId = "user-123";

      const userRepository = Container.get(UserRepository) as any;
      const loggerService = Container.get(LoggerService) as any;

      userRepository.findById.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(userService.getUserById(userId)).rejects.toThrow();
      expect(loggerService.error).toHaveBeenCalledWith(
        "Error fetching user",
        expect.objectContaining({
          userId,
          error: "Database connection failed",
        }),
      );
    });

    it("should handle cache errors gracefully", async () => {
      const userId = "user-123";
      const dbUser = {
        id: userId,
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
      };

      const cacheService = Container.get(CacheService) as any;
      const userRepository = Container.get(UserRepository) as any;
      const loggerService = Container.get(LoggerService) as any;

      cacheService.get.mockRejectedValue(
        new Error("Cache service unavailable"),
      );
      userRepository.findById.mockResolvedValue(dbUser);

      const result = await userService.getUserById(userId);

      expect(result).toEqual(dbUser);
      expect(loggerService.warn).toHaveBeenCalledWith(
        "Cache service error",
        expect.objectContaining({
          operation: "get",
          key: `user:${userId}`,
        }),
      );
    });
  });

  describe("Performance", () => {
    it("should handle concurrent user lookups efficiently", async () => {
      const userIds = ["user-1", "user-2", "user-3", "user-4", "user-5"];
      const users = userIds.map((id) => ({
        id,
        email: `${id}@example.com`,
        firstName: "Test",
        lastName: "User",
      }));

      const cacheService = Container.get(CacheService) as any;
      const userRepository = Container.get(UserRepository) as any;

      cacheService.get.mockResolvedValue(null);
      userRepository.findById.mockImplementation((id) =>
        Promise.resolve(users.find((u) => u.id === id)),
      );

      const startTime = Date.now();
      const results = await Promise.all(
        userIds.map((id) => userService.getUserById(id)),
      );
      const endTime = Date.now();

      expect(results).toHaveLength(5);
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
    });
  });
});
