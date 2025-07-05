import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  type MockedFunction,
} from "vitest";
import { UserController } from "../user.controller";
import { UserService } from "../../services/user.service";
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  UpdateProfileDto,
} from "../../models/dtos/user";
import { ForbiddenException } from "../../exceptions/http-exceptions";
import { UserRole } from "../../models/enums/user-roles.enum";
import { UserStatus } from "../../models/enums/user-status.enum";
import { IAuthenticatedUser } from "../../types/express";

vi.mock("../../services/user.service");

describe("UserController", () => {
  let userController: UserController;
  let mockUserService: Partial<{
    [K in keyof UserService]: MockedFunction<UserService[K]>;
  }>;

  const mockUser = {
    id: "user-123",
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
  };

  const mockAdmin: IAuthenticatedUser = {
    id: "admin-123",
    email: "admin@example.com",
    role: UserRole.ADMIN,
    supabaseUser: {} as any,
  };

  const mockRegularUser: IAuthenticatedUser = {
    id: "user-123",
    email: "user@example.com",
    role: UserRole.USER,
    supabaseUser: {} as any,
  };

  beforeEach(() => {
    mockUserService = {
      findAll: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateStatus: vi.fn(),
      search: vi.fn(),
    };

    userController = new UserController(
      mockUserService as unknown as UserService,
    );
  });

  describe("getUsers", () => {
    it("should get all users successfully", async () => {
      const mockPaginatedResult = {
        data: [mockUser],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          hasNext: false,
          hasPrevious: false,
        },
      };

      mockUserService.findAll!.mockResolvedValue(mockPaginatedResult);

      const result = await userController.getUsers(1, 10);

      expect(result).toEqual({
        success: true,
        message: "Users retrieved successfully",
        data: mockPaginatedResult,
        timestamp: expect.any(Date),
      });
      expect(mockUserService.findAll).toHaveBeenCalledWith(1, 10, {
        role: undefined,
        status: undefined,
        search: undefined,
      });
    });
  });

  describe("getUser", () => {
    it("should allow admin to get any user", async () => {
      mockUserService.findById!.mockResolvedValue(mockUser);

      const result = await userController.getUser("user-123", mockAdmin);

      expect(result).toEqual({
        success: true,
        message: "User retrieved successfully",
        data: mockUser,
        timestamp: expect.any(Date),
      });
      expect(mockUserService.findById).toHaveBeenCalledWith("user-123");
    });

    it("should allow user to get their own profile", async () => {
      mockUserService.findById!.mockResolvedValue(mockUser);

      const result = await userController.getUser("user-123", mockRegularUser);

      expect(result).toEqual({
        success: true,
        message: "User retrieved successfully",
        data: mockUser,
        timestamp: expect.any(Date),
      });
    });

    it("should deny regular user access to other users", async () => {
      await expect(
        userController.getUser("other-user-123", mockRegularUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("createUser", () => {
    it("should create user successfully", async () => {
      const createUserDto: CreateUserDto = {
        email: "new@example.com",
        first_name: "New",
        last_name: "User",
        password: "Password123!",
        role: UserRole.USER,
      };

      mockUserService.create!.mockResolvedValue(mockUser);

      const result = await userController.createUser(createUserDto);

      expect(result).toEqual({
        success: true,
        message: "User created successfully",
        data: mockUser,
        timestamp: expect.any(Date),
      });
      expect(mockUserService.create).toHaveBeenCalledWith(createUserDto);
    });
  });

  describe("updateUser", () => {
    it("should allow admin to update any user", async () => {
      const updateUserDto: UpdateUserDto = {
        first_name: "Updated",
        last_name: "Name",
        role: UserRole.MODERATOR,
      };

      mockUserService.update!.mockResolvedValue({
        ...mockUser,
        ...updateUserDto,
      });

      const result = await userController.updateUser(
        "user-123",
        updateUserDto,
        mockAdmin,
      );

      expect(result).toEqual({
        success: true,
        message: "User updated successfully",
        data: { ...mockUser, ...updateUserDto },
        timestamp: expect.any(Date),
      });
      expect(mockUserService.update).toHaveBeenCalledWith(
        "user-123",
        updateUserDto,
      );
    });

    it("should allow user to update their own profile", async () => {
      const updateUserDto: UpdateUserDto = {
        first_name: "Updated",
        last_name: "Name",
        role: UserRole.ADMIN, // This should be removed
      };

      const expectedDto = {
        first_name: "Updated",
        last_name: "Name",
      };

      mockUserService.update!.mockResolvedValue({
        ...mockUser,
        ...expectedDto,
      });

      const result = await userController.updateUser(
        "user-123",
        updateUserDto,
        mockRegularUser,
      );

      expect(result).toEqual({
        success: true,
        message: "User updated successfully",
        data: { ...mockUser, ...expectedDto },
        timestamp: expect.any(Date),
      });
      expect(mockUserService.update).toHaveBeenCalledWith(
        "user-123",
        expectedDto,
      );
    });

    it("should deny regular user access to update other users", async () => {
      const updateUserDto: UpdateUserDto = {
        first_name: "Updated",
      };

      await expect(
        userController.updateUser(
          "other-user-123",
          updateUserDto,
          mockRegularUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("deleteUser", () => {
    it("should delete user successfully", async () => {
      mockUserService.delete!.mockResolvedValue(undefined);

      const result = await userController.deleteUser("user-123");

      expect(result).toEqual({
        success: true,
        message: "User deleted successfully",
        timestamp: expect.any(Date),
      });
      expect(mockUserService.delete).toHaveBeenCalledWith("user-123");
    });
  });

  describe("searchUsers", () => {
    it("should search users successfully", async () => {
      const mockPaginatedResult = {
        data: [mockUser],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          hasNext: false,
          hasPrevious: false,
        },
      };

      mockUserService.search!.mockResolvedValue(mockPaginatedResult);

      const result = await userController.searchUsers("test", 1, 10);

      expect(result).toEqual({
        success: true,
        message: "User search completed successfully",
        data: mockPaginatedResult,
        timestamp: expect.any(Date),
      });
      expect(mockUserService.search).toHaveBeenCalledWith("test", 1, 10);
    });
  });

  describe("updateUserStatus", () => {
    it("should update user status successfully", async () => {
      const updateStatusDto: UpdateUserStatusDto = {
        status: UserStatus.SUSPENDED,
      };

      mockUserService.updateStatus!.mockResolvedValue({
        ...mockUser,
        status: UserStatus.SUSPENDED,
      });

      const result = await userController.updateUserStatus(
        "user-123",
        updateStatusDto,
      );

      expect(result).toEqual({
        success: true,
        message: "User status updated successfully",
        data: { ...mockUser, status: UserStatus.SUSPENDED },
        timestamp: expect.any(Date),
      });
      expect(mockUserService.updateStatus).toHaveBeenCalledWith(
        "user-123",
        UserStatus.SUSPENDED,
      );
    });
  });

  describe("getProfile", () => {
    it("should get current user profile successfully", async () => {
      mockUserService.findById!.mockResolvedValue(mockUser);

      const result = await userController.getProfile(mockRegularUser);

      expect(result).toEqual({
        success: true,
        message: "Profile retrieved successfully",
        data: mockUser,
        timestamp: expect.any(Date),
      });
      expect(mockUserService.findById).toHaveBeenCalledWith(mockRegularUser.id);
    });
  });

  describe("updateProfile", () => {
    it("should update current user profile successfully", async () => {
      const updateProfileDto: UpdateProfileDto = {
        first_name: "Updated",
        last_name: "Name",
        phone: "+9876543210",
      };

      mockUserService.update!.mockResolvedValue({
        ...mockUser,
        ...updateProfileDto,
      });

      const result = await userController.updateProfile(
        mockRegularUser,
        updateProfileDto,
      );

      expect(result).toEqual({
        success: true,
        message: "Profile updated successfully",
        data: { ...mockUser, ...updateProfileDto },
        timestamp: expect.any(Date),
      });
      expect(mockUserService.update).toHaveBeenCalledWith(
        mockRegularUser.id,
        updateProfileDto,
      );
    });
  });
});
