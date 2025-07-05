import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  type MockedFunction,
} from "vitest";
import { UserService } from "@services/user.service";
import { UserRepository } from "@repositories/user.repository";
import { CreateUserDto } from "@models/dtos/user/create-user.dto";
import { UpdateUserDto } from "@models/dtos/user/update-user.dto";
import {
  ValidationException,
  NotFoundException,
} from "@exceptions/http-exceptions";
import { UserRole } from "@models/enums/user-roles.enum";
import { UserStatus } from "@models/enums/user-status.enum";
import { IUserEntity } from "@models/entities/user.entity";

vi.mock("@repositories/user.repository");

describe("UserService", () => {
  let userService: UserService;
  let mockUserRepository: Partial<{
    [K in keyof UserRepository]: MockedFunction<UserRepository[K]>;
  }>;

  const mockUser: IUserEntity = {
    id: "user-123",
    email: "test@example.com",
    first_name: "Test",
    last_name: "User",
    password_hash: "hashed_password",
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    email_verified: true,
    phone: "+1234567890",
    avatar_url: "https://example.com/avatar.jpg",
    last_login: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    full_name: "Test User",
    isActive: () => true,
    isAdmin: () => false,
    isModerator: () => false,
    hasRole: (role: UserRole) => role === UserRole.USER,
    hasAnyRole: (...roles: UserRole[]) => roles.includes(UserRole.USER),
  };

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: vi.fn(),
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      findUsersPaginated: vi.fn(),
      isEmailUnique: vi.fn(),
    };

    userService = new UserService(
      mockUserRepository as unknown as UserRepository,
    );
  });

  describe("create", () => {
    it("should create a new user successfully", async () => {
      const createUserDto: CreateUserDto = {
        email: "test@example.com",
        first_name: "Test",
        last_name: "User",
        password: "Password123!",
        role: UserRole.USER,
        phone: "+1234567890",
      };

      mockUserRepository.findByEmail!.mockResolvedValue(null);
      mockUserRepository.create!.mockResolvedValue(mockUser);

      const result = await userService.create(createUserDto);

      expect(result).toBeDefined();
      expect(result.email).toBe(createUserDto.email);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(
        createUserDto.email,
      );
      expect(mockUserRepository.create).toHaveBeenCalled();
    });

    it("should throw ValidationException when email already exists", async () => {
      const createUserDto: CreateUserDto = {
        email: "existing@example.com",
        first_name: "Test",
        last_name: "User",
        password: "Password123!",
      };

      mockUserRepository.findByEmail!.mockResolvedValue(mockUser);

      await expect(userService.create(createUserDto)).rejects.toThrow(
        ValidationException,
      );
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(
        createUserDto.email,
      );
    });
  });

  describe("findById", () => {
    it("should find user by id successfully", async () => {
      mockUserRepository.findById!.mockResolvedValue(mockUser);

      const result = await userService.findById("user-123");

      expect(result).toBeDefined();
      expect(result.id).toBe("user-123");
      expect(mockUserRepository.findById).toHaveBeenCalledWith("user-123");
    });

    it("should throw NotFoundException when user not found", async () => {
      mockUserRepository.findById!.mockResolvedValue(null);

      await expect(userService.findById("non-existent")).rejects.toThrow(
        NotFoundException,
      );
      expect(mockUserRepository.findById).toHaveBeenCalledWith("non-existent");
    });
  });

  describe("update", () => {
    it("should update user successfully", async () => {
      const updateUserDto: UpdateUserDto = {
        first_name: "Updated",
        last_name: "Name",
      };

      mockUserRepository.findById!.mockResolvedValue(mockUser);
      mockUserRepository.update!.mockResolvedValue({
        ...mockUser,
        ...updateUserDto,
      });

      const result = await userService.update("user-123", updateUserDto);

      expect(result).toBeDefined();
      expect(mockUserRepository.findById).toHaveBeenCalledWith("user-123");
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        "user-123",
        updateUserDto,
      );
    });

    it("should check email uniqueness when updating email", async () => {
      const updateUserDto: UpdateUserDto = {
        email: "newemail@example.com",
      };

      mockUserRepository.findById!.mockResolvedValue(mockUser);
      mockUserRepository.isEmailUnique!.mockResolvedValue(true);
      mockUserRepository.update!.mockResolvedValue({
        ...mockUser,
        ...updateUserDto,
      });

      const result = await userService.update("user-123", updateUserDto);

      expect(result).toBeDefined();
      expect(mockUserRepository.isEmailUnique).toHaveBeenCalledWith(
        "newemail@example.com",
        "user-123",
      );
    });

    it("should throw ValidationException when email is not unique", async () => {
      const updateUserDto: UpdateUserDto = {
        email: "existing@example.com",
      };

      mockUserRepository.findById!.mockResolvedValue(mockUser);
      mockUserRepository.isEmailUnique!.mockResolvedValue(false);

      await expect(
        userService.update("user-123", updateUserDto),
      ).rejects.toThrow(ValidationException);
    });

    it("should throw NotFoundException when user not found", async () => {
      const updateUserDto: UpdateUserDto = {
        first_name: "Updated",
      };

      mockUserRepository.findById!.mockResolvedValue(null);

      await expect(
        userService.update("non-existent", updateUserDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("delete", () => {
    it("should delete user successfully", async () => {
      mockUserRepository.findById!.mockResolvedValue(mockUser);
      mockUserRepository.softDelete!.mockResolvedValue(undefined);

      await userService.delete("user-123");

      expect(mockUserRepository.findById).toHaveBeenCalledWith("user-123");
      expect(mockUserRepository.softDelete).toHaveBeenCalledWith("user-123");
    });

    it("should throw NotFoundException when user not found", async () => {
      mockUserRepository.findById!.mockResolvedValue(null);

      await expect(userService.delete("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("updateStatus", () => {
    it("should update user status successfully", async () => {
      mockUserRepository.findById!.mockResolvedValue(mockUser);
      mockUserRepository.update!.mockResolvedValue({
        ...mockUser,
        status: UserStatus.SUSPENDED,
      });

      const result = await userService.updateStatus(
        "user-123",
        UserStatus.SUSPENDED,
      );

      expect(result).toBeDefined();
      expect(mockUserRepository.findById).toHaveBeenCalledWith("user-123");
      expect(mockUserRepository.update).toHaveBeenCalledWith("user-123", {
        status: UserStatus.SUSPENDED,
      });
    });

    it("should throw NotFoundException when user not found", async () => {
      mockUserRepository.findById!.mockResolvedValue(null);

      await expect(
        userService.updateStatus("non-existent", UserStatus.SUSPENDED),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("search", () => {
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

      mockUserRepository.findUsersPaginated!.mockResolvedValue(
        mockPaginatedResult,
      );

      const result = await userService.search("test", 1, 10);

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(mockUserRepository.findUsersPaginated).toHaveBeenCalledWith(
        1,
        10,
        { search: "test" },
      );
    });
  });
});
