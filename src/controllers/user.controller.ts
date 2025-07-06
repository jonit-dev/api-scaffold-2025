import {
  JsonController,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  QueryParam,
  HttpCode,
  Req,
} from "routing-controllers";
import { Service } from "typedi";
import { Request } from "express";
import { UserService } from "../services/user.service";
import { CreateUserDto } from "../models/dtos/user/create-user.dto";
import { UpdateUserDto } from "../models/dtos/user/update-user.dto";
import { UserResponseDto } from "../models/dtos/user/user-response.dto";
import { UserRole } from "../models/enums/user-roles.enum";
import { UserStatus } from "../models/enums/user-status.enum";
import { IUserFilters } from "../models/interfaces/user.interface";
import { IPaginatedResult } from "../types/database.types";
import { IAuthenticatedUser } from "../types/express";
import { Authenticated } from "../decorators/auth.decorator";
import { RateLimit } from "../decorators/rate-limit.decorator";
import { authRateLimits } from "../middlewares/rate-limit.middleware";
import { BadRequestException } from "../exceptions/http-exceptions";

@JsonController("/users")
@Service()
export class UserController {
  constructor(private userService: UserService) {}

  @Post("/")
  @HttpCode(201)
  @Authenticated()
  @RateLimit(authRateLimits.register)
  async createUser(
    @Body() createUserDto: CreateUserDto,
  ): Promise<UserResponseDto> {
    return await this.userService.create(createUserDto);
  }

  @Get("/")
  @HttpCode(200)
  @Authenticated()
  async getAllUsers(
    @QueryParam("page") page: number = 1,
    @QueryParam("limit") limit: number = 10,
    @QueryParam("role") role?: UserRole,
    @QueryParam("status") status?: UserStatus,
    @QueryParam("emailVerified") emailVerified?: boolean,
    @QueryParam("search") search?: string,
  ): Promise<IPaginatedResult<UserResponseDto>> {
    const filters: IUserFilters = {};

    if (role) filters.role = role;
    if (status) filters.status = status;
    if (emailVerified !== undefined) filters.emailVerified = emailVerified;
    if (search) filters.search = search;

    return await this.userService.findAll(page, limit, filters);
  }

  @Get("/:id")
  @HttpCode(200)
  @Authenticated()
  async getUserById(@Param("id") id: string): Promise<UserResponseDto> {
    if (!id) {
      throw new BadRequestException("User ID is required");
    }
    return await this.userService.findById(id);
  }

  @Put("/:id")
  @HttpCode(200)
  @Authenticated()
  async updateUser(
    @Param("id") id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    if (!id) {
      throw new BadRequestException("User ID is required");
    }
    return await this.userService.update(id, updateUserDto);
  }

  @Delete("/:id")
  @HttpCode(204)
  @Authenticated()
  async deleteUser(@Param("id") id: string): Promise<void> {
    if (!id) {
      throw new BadRequestException("User ID is required");
    }
    await this.userService.delete(id);
  }

  @Put("/:id/status")
  @HttpCode(200)
  @Authenticated()
  async updateUserStatus(
    @Param("id") id: string,
    @Body() body: { status: UserStatus },
  ): Promise<UserResponseDto> {
    if (!id) {
      throw new BadRequestException("User ID is required");
    }
    if (!body.status) {
      throw new BadRequestException("Status is required");
    }
    return await this.userService.updateStatus(id, body.status);
  }

  @Get("/search")
  @HttpCode(200)
  @Authenticated()
  async searchUsers(
    @QueryParam("q") query: string,
    @QueryParam("page") page: number = 1,
    @QueryParam("limit") limit: number = 10,
  ): Promise<IPaginatedResult<UserResponseDto>> {
    if (!query) {
      throw new BadRequestException("Search query is required");
    }
    return await this.userService.search(query, page, limit);
  }

  @Get("/me")
  @HttpCode(200)
  @Authenticated()
  async getCurrentUser(
    @Req() req: Request & { user: IAuthenticatedUser },
  ): Promise<UserResponseDto> {
    return await this.userService.findById(req.user.id);
  }

  @Put("/me")
  @HttpCode(200)
  @Authenticated()
  async updateCurrentUser(
    @Req() req: Request & { user: IAuthenticatedUser },
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return await this.userService.update(req.user.id, updateUserDto);
  }
}
