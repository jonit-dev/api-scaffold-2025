import { describe, it, expect, beforeEach } from "vitest";
import { UserService } from "@services/user.service";
import { CreateUserDto } from "@models/dtos/user/create-user.dto";
import { UpdateUserDto } from "@models/dtos/user/update-user.dto";
import {
  ValidationException,
  NotFoundException,
} from "@exceptions/http-exceptions";
import { UserRole } from "@models/enums/user-roles.enum";
import { UserStatus } from "@models/enums/user-status.enum";
import {
  SetupHelpers,
  MockHelpers,
  AssertionHelpers,
} from "@tests/utils/test.helpers";

describe("UserService", () => {
  let userService: UserService;
  let mockUserRepository: any;
  let testData: any;

  beforeEach(() => {
    const setup = SetupHelpers.createUserServiceTestSetup();
    userService = setup.userService;
    mockUserRepository = setup.mockUserRepository;
    testData = MockHelpers.createTestDataSets();
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

      MockHelpers.setupRepositoryResponses(mockUserRepository, {
        findByEmail: null, // Email is unique
        create: testData.users.regular,
      });

      const result = await userService.create(createUserDto);

      AssertionHelpers.expectUserStructure(result, {
        email: createUserDto.email,
      });
      AssertionHelpers.expectRepositoryCalls(mockUserRepository, [
        { method: "findByEmail", args: [createUserDto.email] },
        { method: "create" },
      ]);
    });

    it("should throw ValidationException when email already exists", async () => {
      const createUserDto: CreateUserDto = {
        email: "existing@example.com",
        first_name: "Test",
        last_name: "User",
        password: "Password123!",
      };

      MockHelpers.setupRepositoryResponses(mockUserRepository, {
        findByEmail: testData.users.regular, // Email exists
      });

      await AssertionHelpers.expectAsyncError(
        () => userService.create(createUserDto),
        ValidationException,
      );
      AssertionHelpers.expectRepositoryCalls(mockUserRepository, [
        { method: "findByEmail", args: [createUserDto.email] },
      ]);
    });
  });

  describe("findById", () => {
    it("should find user by id successfully", async () => {
      MockHelpers.setupRepositoryResponses(mockUserRepository, {
        findById: testData.users.regular,
      });

      const result = await userService.findById("user-123");

      AssertionHelpers.expectUserStructure(result);
      AssertionHelpers.expectRepositoryCalls(mockUserRepository, [
        { method: "findById", args: ["user-123"] },
      ]);
    });

    it("should throw NotFoundException when user not found", async () => {
      MockHelpers.setupRepositoryResponses(mockUserRepository, {
        findById: null,
      });

      await AssertionHelpers.expectAsyncError(
        () => userService.findById("non-existent"),
        NotFoundException,
      );
      AssertionHelpers.expectRepositoryCalls(mockUserRepository, [
        { method: "findById", args: ["non-existent"] },
      ]);
    });
  });

  describe("update", () => {
    it("should update user successfully", async () => {
      const updateUserDto: UpdateUserDto = {
        first_name: "Updated",
        last_name: "Name",
      };

      mockUserRepository.findById!.mockResolvedValue(testData.users.regular);
      mockUserRepository.update!.mockResolvedValue({
        ...testData.users.regular,
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

      mockUserRepository.findById!.mockResolvedValue(testData.users.regular);
      mockUserRepository.isEmailUnique!.mockResolvedValue(true);
      mockUserRepository.update!.mockResolvedValue({
        ...testData.users.regular,
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

      mockUserRepository.findById!.mockResolvedValue(testData.users.regular);
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
      mockUserRepository.findById!.mockResolvedValue(testData.users.regular);
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
      mockUserRepository.findById!.mockResolvedValue(testData.users.regular);
      mockUserRepository.update!.mockResolvedValue({
        ...testData.users.regular,
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
      MockHelpers.setupRepositoryResponses(mockUserRepository, {
        findUsersPaginated: testData.pagination.firstPage,
      });

      const result = await userService.search("test", 1, 10);

      AssertionHelpers.expectPaginationResponse(result, 2);
      AssertionHelpers.expectRepositoryCalls(mockUserRepository, [
        { method: "findUsersPaginated", args: [1, 10, { search: "test" }] },
      ]);
    });

    it("should use default pagination values for search", async () => {
      MockHelpers.setupRepositoryResponses(mockUserRepository, {
        findUsersPaginated: testData.pagination.firstPage,
      });

      const result = await userService.search("test");

      AssertionHelpers.expectPaginationResponse(result, 2);
      AssertionHelpers.expectRepositoryCalls(mockUserRepository, [
        { method: "findUsersPaginated", args: [1, 10, { search: "test" }] },
      ]);
    });
  });

  describe("findAll", () => {
    it("should return paginated users successfully", async () => {
      MockHelpers.setupRepositoryResponses(mockUserRepository, {
        findUsersPaginated: testData.pagination.firstPage,
      });

      const result = await userService.findAll(1, 10);

      AssertionHelpers.expectPaginationResponse(result, 2);
      AssertionHelpers.expectRepositoryCalls(mockUserRepository, [
        { method: "findUsersPaginated", args: [1, 10, undefined] },
      ]);
    });

    it("should apply filters when provided", async () => {
      const filters = { role: UserRole.ADMIN, status: UserStatus.ACTIVE };
      MockHelpers.setupRepositoryResponses(mockUserRepository, {
        findUsersPaginated: testData.pagination.firstPage,
      });

      const result = await userService.findAll(1, 10, filters);

      AssertionHelpers.expectPaginationResponse(result, 2);
      AssertionHelpers.expectRepositoryCalls(mockUserRepository, [
        { method: "findUsersPaginated", args: [1, 10, filters] },
      ]);
    });

    it("should use default pagination values", async () => {
      MockHelpers.setupRepositoryResponses(mockUserRepository, {
        findUsersPaginated: testData.pagination.firstPage,
      });

      const result = await userService.findAll();

      AssertionHelpers.expectPaginationResponse(result, 2);
      AssertionHelpers.expectRepositoryCalls(mockUserRepository, [
        { method: "findUsersPaginated", args: [1, 10, undefined] },
      ]);
    });
  });
});
