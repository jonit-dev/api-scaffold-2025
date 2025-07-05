import {
  JsonController,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  QueryParam,
  CurrentUser,
} from "routing-controllers";
import { Service } from "typedi";
import { UserService } from "../services/user.service";
import { CreateUserDto } from "../models/dtos/user/create-user.dto";
import { UpdateUserDto } from "../models/dtos/user/update-user.dto";
import { UserResponseDto } from "../models/dtos/user/user-response.dto";
import { UpdateUserStatusDto } from "../models/dtos/user/update-user-status.dto";
import { UpdateProfileDto } from "../models/dtos/user/update-profile.dto";
import { IApiResponse } from "../models/dtos/common/api-response.dto";
import { IPaginatedResult } from "../types/database.types";
import { UserRole } from "../models/enums/user-roles.enum";
import { UserStatus } from "../models/enums/user-status.enum";
import { IUserFilters } from "../models/interfaces/user.interface";
import { IAuthenticatedUser } from "../types/express";
import { Authenticated } from "../decorators/auth.decorator";
import { RequireRole } from "../decorators/auth.decorator";
import { ForbiddenException } from "../exceptions/http-exceptions";

@JsonController("/api/users")
@Service()
export class UserController {
  constructor(private userService: UserService) {}

  @Get("/")
  @RequireRole(UserRole.ADMIN, UserRole.MODERATOR)
  async getUsers(
    @QueryParam("page") page: number = 1,
    @QueryParam("limit") limit: number = 10,
    @QueryParam("role") role?: UserRole,
    @QueryParam("status") status?: UserStatus,
    @QueryParam("search") search?: string,
  ): Promise<IApiResponse<IPaginatedResult<UserResponseDto>>> {
    const filters: IUserFilters = { role, status, search };
    const result = await this.userService.findAll(page, limit, filters);

    return {
      success: true,
      message: "Users retrieved successfully",
      data: result,
      timestamp: new Date(),
    };
  }

  @Get("/:id")
  @Authenticated()
  async getUser(
    @Param("id") id: string,
    @CurrentUser() currentUser: IAuthenticatedUser,
  ): Promise<IApiResponse<UserResponseDto>> {
    // Users can only access their own profile or admins can access any
    if (currentUser.id !== id && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Access denied");
    }

    const result = await this.userService.findById(id);

    return {
      success: true,
      message: "User retrieved successfully",
      data: result,
      timestamp: new Date(),
    };
  }

  @Post("/")
  @RequireRole(UserRole.ADMIN)
  async createUser(
    @Body() createUserDto: CreateUserDto,
  ): Promise<IApiResponse<UserResponseDto>> {
    const result = await this.userService.create(createUserDto);

    return {
      success: true,
      message: "User created successfully",
      data: result,
      timestamp: new Date(),
    };
  }

  @Put("/:id")
  @Authenticated()
  async updateUser(
    @Param("id") id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: IAuthenticatedUser,
  ): Promise<IApiResponse<UserResponseDto>> {
    // Users can only update their own profile or admins can update any
    if (currentUser.id !== id && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Access denied");
    }

    // Non-admins cannot update role or status
    if (currentUser.role !== UserRole.ADMIN) {
      delete updateUserDto.role;
      delete updateUserDto.status;
    }

    const result = await this.userService.update(id, updateUserDto);

    return {
      success: true,
      message: "User updated successfully",
      data: result,
      timestamp: new Date(),
    };
  }

  @Delete("/:id")
  @RequireRole(UserRole.ADMIN)
  async deleteUser(@Param("id") id: string): Promise<IApiResponse<void>> {
    await this.userService.delete(id);

    return {
      success: true,
      message: "User deleted successfully",
      timestamp: new Date(),
    };
  }

  @Get("/search")
  @RequireRole(UserRole.ADMIN, UserRole.MODERATOR)
  async searchUsers(
    @QueryParam("q") query: string,
    @QueryParam("page") page: number = 1,
    @QueryParam("limit") limit: number = 10,
  ): Promise<IApiResponse<IPaginatedResult<UserResponseDto>>> {
    const result = await this.userService.search(query, page, limit);

    return {
      success: true,
      message: "User search completed successfully",
      data: result,
      timestamp: new Date(),
    };
  }

  @Put("/:id/status")
  @RequireRole(UserRole.ADMIN)
  async updateUserStatus(
    @Param("id") id: string,
    @Body() updateStatusDto: UpdateUserStatusDto,
  ): Promise<IApiResponse<UserResponseDto>> {
    const result = await this.userService.updateStatus(
      id,
      updateStatusDto.status,
    );

    return {
      success: true,
      message: "User status updated successfully",
      data: result,
      timestamp: new Date(),
    };
  }

  @Get("/profile")
  @Authenticated()
  async getProfile(
    @CurrentUser() currentUser: IAuthenticatedUser,
  ): Promise<IApiResponse<UserResponseDto>> {
    const result = await this.userService.findById(currentUser.id);

    return {
      success: true,
      message: "Profile retrieved successfully",
      data: result,
      timestamp: new Date(),
    };
  }

  @Put("/profile")
  @Authenticated()
  async updateProfile(
    @CurrentUser() currentUser: IAuthenticatedUser,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<IApiResponse<UserResponseDto>> {
    const result = await this.userService.update(
      currentUser.id,
      updateProfileDto,
    );

    return {
      success: true,
      message: "Profile updated successfully",
      data: result,
      timestamp: new Date(),
    };
  }
}
