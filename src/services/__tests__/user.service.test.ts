import { describe, it, expect, beforeEach, vi } from "vitest";
import { Container } from "typedi";
import { UserService } from "../user.service";
import { UserRepository } from "../../repositories/user.repository";
import { UserRole } from "../../models/enums/user-roles.enum";
import { UserStatus } from "../../models/enums/user-status.enum";
import {
  ValidationException,
  NotFoundException,
} from "../../exceptions/http-exceptions";

describe("UserService Tests", () => {
  let userService: UserService;
  let mockUserRepository: any;

  beforeEach(() => {
    // Clear any existing mocks
    vi.clearAllMocks();

    // Reset the Container
    Container.reset();

    // Mock UserRepository
    mockUserRepository = {
      findByEmail: vi.fn(),
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      findByStripeCustomerId: vi.fn(),
      findUsersPaginated: vi.fn(),
      softDelete: vi.fn(),
    };

    Container.set(UserRepository, mockUserRepository);
    userService = new UserService(mockUserRepository);
  });

  describe("create", () => {
    it("should create a new user successfully", async () => {
      const createUserDto = {
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        password: "TestPass123!",
        role: UserRole.User,
      };

      const createdUser = {
        id: "user-123",
        ...createUserDto,
        status: UserStatus.Active,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(createdUser);

      const result = await userService.create(createUserDto);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(
        createUserDto.email,
      );
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          email: createUserDto.email,
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
        }),
      );
    });

    it("should throw ValidationException if email already exists", async () => {
      const createUserDto = {
        email: "existing@example.com",
        firstName: "Test",
        lastName: "User",
        password: "TestPass123!",
        role: UserRole.User,
      };

      const existingUser = {
        id: "existing-user",
        email: createUserDto.email,
      };

      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      await expect(userService.create(createUserDto)).rejects.toThrow(
        ValidationException,
      );
    });
  });

  describe("findById", () => {
    it("should return user by id", async () => {
      const userId = "user-123";
      const user = {
        id: userId,
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
      };

      mockUserRepository.findById.mockResolvedValue(user);

      const result = await userService.findById(userId);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expect.objectContaining(user));
    });

    it("should throw NotFoundException if user does not exist", async () => {
      const userId = "nonexistent-user";

      mockUserRepository.findById.mockResolvedValue(null);

      await expect(userService.findById(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("findAll", () => {
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

      const paginatedResult = {
        data: users,
        pagination: {
          totalItems: totalCount,
          currentPage: page,
          itemsPerPage: limit,
          totalPages: Math.ceil(totalCount / limit),
          hasPrevious: page > 1,
          hasNext: page < Math.ceil(totalCount / limit),
        },
      };

      mockUserRepository.findUsersPaginated.mockResolvedValue(paginatedResult);

      const result = await userService.findAll(page, limit, filters);

      expect(mockUserRepository.findUsersPaginated).toHaveBeenCalledWith(
        page,
        limit,
        filters,
      );
      expect(result).toEqual({
        data: users.map((user) => expect.objectContaining(user)),
        pagination: expect.objectContaining({
          totalItems: totalCount,
          currentPage: page,
          itemsPerPage: limit,
        }),
      });
    });
  });

  describe("update", () => {
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

      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await userService.update(userId, updateData);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        userId,
        updateData,
      );
      expect(result).toEqual(expect.objectContaining(updatedUser));
    });

    it("should throw NotFoundException if user does not exist", async () => {
      const userId = "nonexistent-user";
      const updateData = { firstName: "Updated" };

      mockUserRepository.findById.mockResolvedValue(null);

      await expect(userService.update(userId, updateData)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("delete", () => {
    it("should delete user successfully", async () => {
      const userId = "user-123";
      const existingUser = {
        id: userId,
        email: "test@example.com",
        status: UserStatus.Active,
      };

      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.softDelete.mockResolvedValue(undefined);

      await userService.delete(userId);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockUserRepository.softDelete).toHaveBeenCalledWith(userId);
    });

    it("should throw NotFoundException if user does not exist", async () => {
      const userId = "nonexistent-user";

      mockUserRepository.findById.mockResolvedValue(null);

      await expect(userService.delete(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("updateStatus", () => {
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

      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await userService.updateStatus(userId, newStatus);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
        status: newStatus,
      });
      expect(result).toEqual(expect.objectContaining({ status: newStatus }));
    });

    it("should throw NotFoundException if user does not exist", async () => {
      const userId = "nonexistent-user";
      const newStatus = UserStatus.Suspended;

      mockUserRepository.findById.mockResolvedValue(null);

      await expect(userService.updateStatus(userId, newStatus)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("search", () => {
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

      const searchPaginatedResult = {
        data: searchResults,
        pagination: {
          totalItems: searchResults.length,
          currentPage: 1,
          itemsPerPage: 10,
          totalPages: 1,
          hasPrevious: false,
          hasNext: false,
        },
      };

      mockUserRepository.findUsersPaginated.mockResolvedValue(
        searchPaginatedResult,
      );

      const result = await userService.search(query);

      expect(mockUserRepository.findUsersPaginated).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          data: searchResults.map((user) => expect.objectContaining(user)),
        }),
      );
    });
  });
});
