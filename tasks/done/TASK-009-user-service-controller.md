# TASK-009: User Service and Controller Implementation

## Epic

User Management

## Story Points

6

## Priority

High

## Description

Create user service with business logic and user controller with CRUD operations, implementing proper authorization and data validation.

## Acceptance Criteria

### ✅ User Service

- [ ] Create `src/services/user.service.ts`
- [ ] Implement user creation with validation
- [ ] Add user update functionality
- [ ] Create user retrieval methods
- [ ] Implement user deletion (soft delete)
- [ ] Add user search and filtering
- [ ] Implement user profile management
- [ ] Add user status management

### ✅ User Controller

- [ ] Create `src/controllers/user.controller.ts`
- [ ] Implement get all users endpoint (`GET /api/users`)
- [ ] Create get user by ID endpoint (`GET /api/users/:id`)
- [ ] Add create user endpoint (`POST /api/users`)
- [ ] Implement update user endpoint (`PUT /api/users/:id`)
- [ ] Create delete user endpoint (`DELETE /api/users/:id`)
- [ ] Add user search endpoint (`GET /api/users/search`)
- [ ] Implement user profile endpoints

### ✅ Authorization & Permissions

- [ ] Implement role-based access control
- [ ] Add user self-management permissions
- [ ] Create admin-only operations
- [ ] Implement user data privacy rules
- [ ] Add permission validation for sensitive operations

### ✅ Data Validation & Transformation

- [ ] Validate all user input data
- [ ] Implement data transformation for responses
- [ ] Add pagination for user lists
- [ ] Create user filtering and sorting
- [ ] Implement proper error handling

## Technical Requirements

### User Service Structure

```typescript
@Service()
export class UserService {
  constructor(private userRepository: UserRepository) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    // Validate email uniqueness
    const existingUser = await this.userRepository.findByEmail(
      createUserDto.email
    );
    if (existingUser) {
      throw new ValidationException("Email already exists");
    }

    // Hash password if provided
    let passwordHash: string | undefined;
    if (createUserDto.password) {
      passwordHash = await this.hashPassword(createUserDto.password);
    }

    // Create user
    const user = await this.userRepository.create({
      ...createUserDto,
      password_hash: passwordHash,
      status: UserStatus.ACTIVE,
    });

    return this.mapToResponseDto(user);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    filters?: UserFilters
  ): Promise<PaginatedResponse<UserResponseDto>> {
    const { users, total } = await this.userRepository.findWithPagination(
      page,
      limit,
      filters
    );

    return {
      data: users.map(user => this.mapToResponseDto(user)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
    updateUserDto: UpdateUserDto
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Check email uniqueness if email is being updated
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.userRepository.findByEmail(
        updateUserDto.email
      );
      if (existingUser) {
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
    limit: number = 10
  ): Promise<PaginatedResponse<UserResponseDto>> {
    const filters: UserFilters = { search: query };
    return this.findAll(page, limit, filters);
  }

  private mapToResponseDto(user: UserEntity): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      status: user.status,
      email_verified: user.email_verified,
      phone: user.phone,
      avatar_url: user.avatar_url,
      last_login: user.last_login,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }
}
```

### User Controller Structure

```typescript
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
    @QueryParam("search") search?: string
  ): Promise<ApiResponse<PaginatedResponse<UserResponseDto>>> {
    const filters: UserFilters = { role, status, search };
    const result = await this.userService.findAll(page, limit, filters);

    return {
      success: true,
      message: "Users retrieved successfully",
      data: result,
    };
  }

  @Get("/:id")
  @Authenticated()
  async getUser(
    @Param("id") id: string,
    @CurrentUser() currentUser: JwtPayload
  ): Promise<ApiResponse<UserResponseDto>> {
    // Users can only access their own profile or admins can access any
    if (currentUser.userId !== id && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Access denied");
    }

    const result = await this.userService.findById(id);

    return {
      success: true,
      message: "User retrieved successfully",
      data: result,
    };
  }

  @Post("/")
  @RequireRole(UserRole.ADMIN)
  async createUser(
    @Body() createUserDto: CreateUserDto
  ): Promise<ApiResponse<UserResponseDto>> {
    const result = await this.userService.create(createUserDto);

    return {
      success: true,
      message: "User created successfully",
      data: result,
    };
  }

  @Put("/:id")
  @Authenticated()
  async updateUser(
    @Param("id") id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: JwtPayload
  ): Promise<ApiResponse<UserResponseDto>> {
    // Users can only update their own profile or admins can update any
    if (currentUser.userId !== id && currentUser.role !== UserRole.ADMIN) {
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
    };
  }

  @Delete("/:id")
  @RequireRole(UserRole.ADMIN)
  async deleteUser(@Param("id") id: string): Promise<ApiResponse<void>> {
    await this.userService.delete(id);

    return {
      success: true,
      message: "User deleted successfully",
    };
  }

  @Get("/search")
  @RequireRole(UserRole.ADMIN, UserRole.MODERATOR)
  async searchUsers(
    @QueryParam("q") query: string,
    @QueryParam("page") page: number = 1,
    @QueryParam("limit") limit: number = 10
  ): Promise<ApiResponse<PaginatedResponse<UserResponseDto>>> {
    const result = await this.userService.search(query, page, limit);

    return {
      success: true,
      message: "User search completed successfully",
      data: result,
    };
  }

  @Put("/:id/status")
  @RequireRole(UserRole.ADMIN)
  async updateUserStatus(
    @Param("id") id: string,
    @Body() updateStatusDto: UpdateUserStatusDto
  ): Promise<ApiResponse<UserResponseDto>> {
    const result = await this.userService.updateStatus(
      id,
      updateStatusDto.status
    );

    return {
      success: true,
      message: "User status updated successfully",
      data: result,
    };
  }

  @Get("/profile")
  @Authenticated()
  async getProfile(
    @CurrentUser() currentUser: JwtPayload
  ): Promise<ApiResponse<UserResponseDto>> {
    const result = await this.userService.findById(currentUser.userId);

    return {
      success: true,
      message: "Profile retrieved successfully",
      data: result,
    };
  }

  @Put("/profile")
  @Authenticated()
  async updateProfile(
    @CurrentUser() currentUser: JwtPayload,
    @Body() updateProfileDto: UpdateProfileDto
  ): Promise<ApiResponse<UserResponseDto>> {
    const result = await this.userService.update(
      currentUser.userId,
      updateProfileDto
    );

    return {
      success: true,
      message: "Profile updated successfully",
      data: result,
    };
  }
}
```

### Additional DTOs

```typescript
export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  @IsNotEmpty()
  status: UserStatus;
}

export class UpdateProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @IsOptional()
  first_name?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @IsOptional()
  last_name?: string;

  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @IsUrl()
  @IsOptional()
  avatar_url?: string;
}

export interface UserFilters {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

## Definition of Done

- [ ] User service implements all CRUD operations
- [ ] User controller has all required endpoints
- [ ] Authorization rules properly implemented
- [ ] Data validation working correctly
- [ ] Pagination implemented for user lists
- [ ] Search functionality working
- [ ] Error handling comprehensive
- [ ] Response format consistent
- [ ] Permission checks enforced

## Testing Strategy

- [ ] Test all CRUD operations
- [ ] Verify authorization rules
- [ ] Test pagination and filtering
- [ ] Check user search functionality
- [ ] Test error handling scenarios
- [ ] Verify data validation
- [ ] Test permission enforcement
- [ ] Check response format consistency

## Dependencies

- TASK-007: Authentication Middleware and Route Protection
- TASK-005: User Model and Repository Implementation

## Notes

- Implement proper logging for user operations
- Ensure sensitive data is never exposed
- Test permission rules thoroughly
- Consider implementing user activity logging
- Keep response times reasonable for large user lists
