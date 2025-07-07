import { plainToClass } from "class-transformer";
import { Service } from "typedi";
import {
  NotFoundException,
  ValidationException,
} from "../exceptions/http-exceptions";
import { CreateUserDto } from "../models/dtos/user/create-user.dto";
import { UpdateUserDto } from "../models/dtos/user/update-user.dto";
import { UserResponseDto } from "../models/dtos/user/user-response.dto";
import { IUserEntity } from "../models/entities/user.entity";
import { UserRole } from "../models/enums/user-roles.enum";
import { UserStatus } from "../models/enums/user-status.enum";
import { IUserFilters } from "../models/interfaces/user.interface";
import { UserRepository } from "../repositories/user.repository";
import { IPaginatedResult } from "../types/database.types";
// import {
//   camelToSnakeKeys,
//   snakeToCamelKeys,
// } from "../utils/case-conversion.utils";

@Service()
export class UserService {
  constructor(private userRepository: UserRepository) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    // Validate email uniqueness
    const existingUser = await this.userRepository.findByEmail(
      createUserDto.email,
    );
    if (existingUser) {
      throw new ValidationException("Email already exists");
    }

    // Create user with defaults - password is handled by Supabase Auth separately
    const userData: Partial<IUserEntity> = {
      email: createUserDto.email,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      passwordHash: "", // This will be managed by Supabase Auth
      role: createUserDto.role || UserRole.User,
      status: UserStatus.Active,
      emailUnsubscribed: false,
      phone: createUserDto.phone,
    };

    const user = await this.userRepository.create(
      userData as Omit<IUserEntity, "id" | "createdAt" | "updatedAt">,
    );
    return this.mapToResponseDto(user);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    filters?: IUserFilters,
  ): Promise<IPaginatedResult<UserResponseDto>> {
    const result = await this.userRepository.findUsersPaginated(
      page,
      limit,
      filters,
    );

    return {
      data: result.data.map((user) => this.mapToResponseDto(user)),
      pagination: result.pagination,
    };
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.mapToResponseDto(user);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Check email uniqueness if email is being updated
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const isUnique = await this.userRepository.isEmailUnique(
        updateUserDto.email,
        id,
      );
      if (!isUnique) {
        throw new ValidationException("Email already exists");
      }
    }

    const updatedUser = await this.userRepository.update(id, updateUserDto);
    return this.mapToResponseDto(updatedUser);
  }

  async delete(id: string): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    await this.userRepository.softDelete(id);
  }

  async updateStatus(id: string, status: UserStatus): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const updatedUser = await this.userRepository.update(id, { status });
    return this.mapToResponseDto(updatedUser);
  }

  async search(
    query: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<IPaginatedResult<UserResponseDto>> {
    const filters: IUserFilters = { search: query };
    return this.findAll(page, limit, filters);
  }

  async findByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<UserResponseDto | null> {
    const user =
      await this.userRepository.findByStripeCustomerId(stripeCustomerId);
    if (!user) {
      return null;
    }
    return this.mapToResponseDto(user);
  }

  async updateEmailUnsubscribed(
    id: string,
    unsubscribed: boolean,
  ): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    await this.userRepository.updateEmailUnsubscribed(id, unsubscribed);
  }

  private mapToResponseDto(user: IUserEntity): UserResponseDto {
    return plainToClass(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }
}
