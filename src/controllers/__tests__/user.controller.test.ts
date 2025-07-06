import { beforeEach, describe, expect, it } from "vitest";
import { UserController } from "../user.controller";
import { UserService } from "@services/user.service";
import { CreateUserDto } from "@models/dtos/user/create-user.dto";
import { UpdateUserDto } from "@models/dtos/user/update-user.dto";
import { UserRole } from "@models/enums/user-roles.enum";
import { UserStatus } from "@models/enums/user-status.enum";
import { AuthFactory } from "@tests/factories/auth.factory";
import { TestHelpers } from "@tests/utils/test.helpers";

describe("UserController Unit Tests", () => {
  let userController: UserController;
  let mockUserService: UserService;

  beforeEach(() => {
    // Create mock service
    mockUserService = TestHelpers.createMockService<UserService>([
      "create",
      "findAll",
      "findById",
      "update",
      "delete",
      "updateStatus",
      "search",
    ]);

    // Create controller with mocked service
    userController = new UserController(mockUserService);
  });

  describe("createUser", () => {
    it("should create a new user successfully", async () => {
      const createUserDto: CreateUserDto = {
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        password: "Password123!",
        role: UserRole.USER,
        phone: "+1234567890",
      };

      const createdUser = AuthFactory.createTestUserResponse({
        email: createUserDto.email,
        first_name: createUserDto.first_name,
        last_name: createUserDto.last_name,
        role: createUserDto.role,
        phone: createUserDto.phone,
      });

      (mockUserService.create as any).mockResolvedValue(createdUser);

      const result = await userController.createUser(createUserDto);

      expect(result).toEqual(createdUser);
      expect(mockUserService.create).toHaveBeenCalledWith(createUserDto);
    });
  });

  describe("getAllUsers", () => {
    it("should get all users with pagination", async () => {
      const users = [
        AuthFactory.createTestUserResponse({ id: "user-1" }),
        AuthFactory.createTestUserResponse({ id: "user-2" }),
      ];

      const paginatedResult = {
        data: users,
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          hasNext: false,
          hasPrevious: false,
        },
      };

      (mockUserService.findAll as any).mockResolvedValue(paginatedResult);

      const result = await userController.getAllUsers(1, 10);

      expect(result).toEqual(paginatedResult);
      expect(mockUserService.findAll).toHaveBeenCalledWith(1, 10, {});
    });

    it("should apply filters when provided", async () => {
      const paginatedResult = {
        data: [AuthFactory.createTestUserResponse({ role: UserRole.ADMIN })],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          hasNext: false,
          hasPrevious: false,
        },
      };

      (mockUserService.findAll as any).mockResolvedValue(paginatedResult);

      const result = await userController.getAllUsers(
        1,
        10,
        UserRole.ADMIN,
        UserStatus.ACTIVE,
        true,
        "john",
      );

      expect(result).toEqual(paginatedResult);
      expect(mockUserService.findAll).toHaveBeenCalledWith(1, 10, {
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        email_verified: true,
        search: "john",
      });
    });
  });

  describe("getUserById", () => {
    it("should get user by id successfully", async () => {
      const userId = "user-123";
      const user = AuthFactory.createTestUserResponse({ id: userId });

      (mockUserService.findById as any).mockResolvedValue(user);

      const result = await userController.getUserById(userId);

      expect(result).toEqual(user);
      expect(mockUserService.findById).toHaveBeenCalledWith(userId);
    });
  });

  describe("updateUser", () => {
    it("should update user successfully", async () => {
      const userId = "user-123";
      const updateUserDto: UpdateUserDto = {
        first_name: "Updated",
        last_name: "Name",
        phone: "+9876543210",
      };

      const updatedUser = AuthFactory.createTestUserResponse({
        id: userId,
        first_name: updateUserDto.first_name,
        last_name: updateUserDto.last_name,
        phone: updateUserDto.phone,
      });

      (mockUserService.update as any).mockResolvedValue(updatedUser);

      const result = await userController.updateUser(userId, updateUserDto);

      expect(result).toEqual(updatedUser);
      expect(mockUserService.update).toHaveBeenCalledWith(
        userId,
        updateUserDto,
      );
    });
  });

  describe("deleteUser", () => {
    it("should delete user successfully", async () => {
      const userId = "user-123";

      (mockUserService.delete as any).mockResolvedValue(undefined);

      await userController.deleteUser(userId);

      expect(mockUserService.delete).toHaveBeenCalledWith(userId);
    });
  });

  describe("updateUserStatus", () => {
    it("should update user status successfully", async () => {
      const userId = "user-123";
      const newStatus = UserStatus.SUSPENDED;

      const updatedUser = AuthFactory.createTestUserResponse({
        id: userId,
        status: newStatus,
      });

      (mockUserService.updateStatus as any).mockResolvedValue(updatedUser);

      const result = await userController.updateUserStatus(userId, {
        status: newStatus,
      });

      expect(result).toEqual(updatedUser);
      expect(mockUserService.updateStatus).toHaveBeenCalledWith(
        userId,
        newStatus,
      );
    });
  });

  describe("searchUsers", () => {
    it("should search users successfully", async () => {
      const query = "john";
      const users = [
        AuthFactory.createTestUserResponse({ first_name: "John" }),
        AuthFactory.createTestUserResponse({ first_name: "Johnny" }),
      ];

      const paginatedResult = {
        data: users,
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          hasNext: false,
          hasPrevious: false,
        },
      };

      (mockUserService.search as any).mockResolvedValue(paginatedResult);

      const result = await userController.searchUsers(query, 1, 10);

      expect(result).toEqual(paginatedResult);
      expect(mockUserService.search).toHaveBeenCalledWith(query, 1, 10);
    });
  });

  describe("getCurrentUser", () => {
    it("should get current user successfully", async () => {
      const userId = "current-user-123";
      const user = AuthFactory.createTestUserResponse({ id: userId });
      const mockRequest = {
        user: { id: userId, email: user.email, role: user.role },
      } as any;

      (mockUserService.findById as any).mockResolvedValue(user);

      const result = await userController.getCurrentUser(mockRequest);

      expect(result).toEqual(user);
      expect(mockUserService.findById).toHaveBeenCalledWith(userId);
    });
  });

  describe("updateCurrentUser", () => {
    it("should update current user successfully", async () => {
      const userId = "current-user-123";
      const updateUserDto: UpdateUserDto = {
        first_name: "Updated",
        phone: "+9876543210",
      };
      const mockRequest = {
        user: { id: userId, email: "test@example.com", role: UserRole.USER },
      } as any;

      const updatedUser = AuthFactory.createTestUserResponse({
        id: userId,
        first_name: updateUserDto.first_name,
        phone: updateUserDto.phone,
      });

      (mockUserService.update as any).mockResolvedValue(updatedUser);

      const result = await userController.updateCurrentUser(
        mockRequest,
        updateUserDto,
      );

      expect(result).toEqual(updatedUser);
      expect(mockUserService.update).toHaveBeenCalledWith(
        userId,
        updateUserDto,
      );
    });
  });
});
