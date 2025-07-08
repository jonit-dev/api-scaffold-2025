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
import { HttpStatus } from "../types/http-status";
import { UserService } from "../services/user.service";
import { CreateUserDto } from "../models/dtos/user/create-user.dto";
import { UpdateUserDto } from "../models/dtos/user/update-user.dto";
import { UserResponseDto } from "../models/dtos/user/user-response.dto";
import { UserRole } from "../models/enums/user-roles.enum";
import { UserStatus } from "../models/enums/user-status.enum";
import { IUserFilters } from "../models/interfaces/user.interface";
import { IPaginatedResult } from "../types/database.types";
import { IAuthenticatedRequest } from "../types/express";
import { Authenticated } from "../decorators/auth.decorator";
import { RateLimit } from "../decorators/rate-limit.decorator";
import { authRateLimits } from "../middlewares/rate-limit.middleware";
import { BadRequestException } from "../exceptions/http-exceptions";

@JsonController("/users")
@Service()
export class UserController {
  constructor(private userService: UserService) {}

  @Post("/")
  @HttpCode(HttpStatus.Created)
  @Authenticated()
  @RateLimit(authRateLimits.register)
  async createUser(
    @Body() createUserDto: CreateUserDto,
  ): Promise<UserResponseDto> {
    return await this.userService.create(createUserDto);
  }

  @Get("/")
  @HttpCode(HttpStatus.Ok)
  @Authenticated()
  async getAllUsers(
    @QueryParam("page") page: number = 1,
    @QueryParam("limit") limit: number = 10,
    @QueryParam("role") role?: UserRole,
    @QueryParam("status") status?: UserStatus,
    @QueryParam("search") search?: string,
  ): Promise<IPaginatedResult<UserResponseDto>> {
    const filters: IUserFilters = {};

    if (role) filters.role = role;
    if (status) filters.status = status;
    if (search) filters.search = search;

    return await this.userService.findAll(page, limit, filters);
  }

  @Get("/:id")
  @HttpCode(HttpStatus.Ok)
  @Authenticated()
  async getUserById(@Param("id") id: string): Promise<UserResponseDto> {
    if (!id) {
      throw new BadRequestException("User ID is required");
    }
    return await this.userService.findById(id);
  }

  @Put("/:id")
  @HttpCode(HttpStatus.Ok)
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
  @HttpCode(HttpStatus.NoContent)
  @Authenticated()
  async deleteUser(@Param("id") id: string): Promise<void> {
    if (!id) {
      throw new BadRequestException("User ID is required");
    }
    await this.userService.delete(id);
  }

  @Put("/:id/status")
  @HttpCode(HttpStatus.Ok)
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
  @HttpCode(HttpStatus.Ok)
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
  @HttpCode(HttpStatus.Ok)
  @Authenticated()
  async getCurrentUser(
    @Req() req: IAuthenticatedRequest,
  ): Promise<UserResponseDto> {
    return await this.userService.findById(req.user.id);
  }

  @Put("/me")
  @HttpCode(HttpStatus.Ok)
  @Authenticated()
  async updateCurrentUser(
    @Req() req: IAuthenticatedRequest,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return await this.userService.update(req.user.id, updateUserDto);
  }

  @Post("/unsubscribe")
  @HttpCode(HttpStatus.Ok)
  @Authenticated()
  async unsubscribeFromEmails(
    @Req() req: IAuthenticatedRequest,
  ): Promise<{ success: boolean; message: string }> {
    await this.userService.updateEmailUnsubscribed(req.user.id, true);
    return {
      success: true,
      message: "Successfully unsubscribed from emails",
    };
  }

  @Post("/resubscribe")
  @HttpCode(HttpStatus.Ok)
  @Authenticated()
  async resubscribeToEmails(
    @Req() req: IAuthenticatedRequest,
  ): Promise<{ success: boolean; message: string }> {
    await this.userService.updateEmailUnsubscribed(req.user.id, false);
    return {
      success: true,
      message: "Successfully resubscribed to emails",
    };
  }
}
