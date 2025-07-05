# TASK-005: User Model and Repository Implementation

## Epic
User Management

## Story Points
5

## Priority
High

## Description
Create the user entity, DTOs, and repository implementation to establish the core user management functionality with proper data access patterns.

## Acceptance Criteria

### ✅ User Entity
- [ ] Create `src/models/entities/user.entity.ts`
- [ ] Define user entity with all required fields
- [ ] Include timestamps (created_at, updated_at)
- [ ] Add user status and role fields
- [ ] Implement proper typing for all fields
- [ ] Add field validation rules

### ✅ User DTOs
- [ ] Create `src/models/dtos/user/create-user.dto.ts`
- [ ] Create `src/models/dtos/user/update-user.dto.ts`
- [ ] Create `src/models/dtos/user/user-response.dto.ts`
- [ ] Add validation decorators to all DTOs
- [ ] Implement proper field transformation
- [ ] Add password field handling (exclude from responses)

### ✅ User Repository
- [ ] Create `src/repositories/user.repository.ts`
- [ ] Extend base repository functionality
- [ ] Implement user-specific query methods
- [ ] Add email uniqueness validation
- [ ] Implement soft delete functionality
- [ ] Add user search and filtering methods

### ✅ User Enums
- [ ] Create `src/models/enums/user-roles.enum.ts`
- [ ] Create `src/models/enums/user-status.enum.ts`
- [ ] Define all possible user roles
- [ ] Define user status states
- [ ] Add proper enum validation

## Technical Requirements

### User Entity Structure
```typescript
export interface UserEntity {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  email_verified: boolean;
  phone?: string;
  avatar_url?: string;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}
```

### User DTOs
```typescript
export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  first_name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  last_name: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  password: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsPhoneNumber()
  @IsOptional()
  phone?: string;
}

export class UserResponseDto {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  status: UserStatus;
  email_verified: boolean;
  phone?: string;
  avatar_url?: string;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
  
  // Password and sensitive fields excluded
}
```

### User Repository Implementation
```typescript
@Service()
export class UserRepository extends BaseRepository<UserEntity> {
  constructor(@Inject('supabase') supabase: SupabaseClient) {
    super(supabase, 'users');
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('email', email)
      .eq('deleted_at', null)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new DatabaseException(error.message);
    }
    return data;
  }

  async findWithPagination(
    page: number = 1,
    limit: number = 10,
    filters?: UserFilters
  ): Promise<{ users: UserEntity[]; total: number }> {
    const offset = (page - 1) * limit;
    let query = this.supabase
      .from(this.tableName)
      .select('*', { count: 'exact' })
      .eq('deleted_at', null);

    if (filters?.role) {
      query = query.eq('role', filters.role);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.search) {
      query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    }

    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) throw new DatabaseException(error.message);

    return {
      users: data || [],
      total: count || 0
    };
  }

  async softDelete(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from(this.tableName)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new DatabaseException(error.message);
    return true;
  }

  async updateLastLogin(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .update({ last_login: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new DatabaseException(error.message);
  }
}
```

### User Enums
```typescript
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification'
}
```

## Definition of Done
- [ ] User entity properly defined with all fields
- [ ] All DTOs created with proper validation
- [ ] User repository extends base repository correctly
- [ ] Email uniqueness validation works
- [ ] Soft delete functionality implemented
- [ ] User search and filtering functional
- [ ] Password handling secure (no plain text storage)
- [ ] All enums properly defined and used
- [ ] TypeScript types are accurate throughout

## Testing Strategy
- [ ] Test user entity field validation
- [ ] Verify DTO validation rules
- [ ] Test repository CRUD operations
- [ ] Verify email uniqueness constraint
- [ ] Test soft delete functionality
- [ ] Check user search and filtering
- [ ] Test password field exclusion from responses
- [ ] Verify enum validation works correctly

## Dependencies
- TASK-003: Supabase Integration and Database Configuration

## Notes
- Never store plain text passwords
- Ensure sensitive data is excluded from response DTOs
- Consider adding indexes for frequently queried fields
- Implement proper error handling for all database operations