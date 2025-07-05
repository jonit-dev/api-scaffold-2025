# TASK-006: Supabase Authentication Service Integration

## Epic
Authentication & Authorization

## Story Points
6

## Priority
High

## Description
Integrate Supabase authentication service for secure user authentication, leveraging Supabase's built-in auth features including JWT tokens, password hashing, and session management.

## Acceptance Criteria

### ✅ Supabase Client Configuration
- [ ] Create `src/config/supabase.ts` for Supabase client setup
- [ ] Configure Supabase URL and API key
- [ ] Set up environment variables for Supabase credentials
- [ ] Initialize Supabase client with proper configuration
- [ ] Configure authentication policies

### ✅ Authentication Service
- [ ] Create `src/services/auth.service.ts`
- [ ] Implement user registration via Supabase Auth
- [ ] Add login functionality using Supabase Auth
- [ ] Implement logout functionality
- [ ] Add session management using Supabase sessions
- [ ] Implement password reset via Supabase Auth
- [ ] Add email verification using Supabase Auth

### ✅ User Management Integration
- [ ] Integrate with Supabase user management
- [ ] Handle user profile creation in database
- [ ] Sync user data between Supabase Auth and application database
- [ ] Implement user role management
- [ ] Add user status tracking

### ✅ Authentication DTOs
- [ ] Create `src/models/dtos/auth/login.dto.ts`
- [ ] Create `src/models/dtos/auth/register.dto.ts`
- [ ] Create `src/models/dtos/auth/reset-password.dto.ts`
- [ ] Create `src/models/dtos/auth/change-password.dto.ts`
- [ ] Add proper validation to all DTOs
- [ ] Include response DTOs for auth endpoints

### ✅ Authentication Exceptions
- [ ] Create `src/exceptions/auth.exception.ts`
- [ ] Implement specific auth error types
- [ ] Add user-friendly error messages
- [ ] Handle Supabase auth errors
- [ ] Create unauthorized access exceptions

## Technical Requirements

### Environment Configuration
```typescript
// src/config/env.ts
interface Environment {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_KEY: string;
  FRONTEND_URL: string;
  NODE_ENV: 'development' | 'production' | 'test';
}

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value;
}

export const env: Environment = {
  SUPABASE_URL: getEnvVar('SUPABASE_URL'),
  SUPABASE_ANON_KEY: getEnvVar('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_KEY: getEnvVar('SUPABASE_SERVICE_KEY'),
  FRONTEND_URL: getEnvVar('FRONTEND_URL'),
  NODE_ENV: (process.env.NODE_ENV as Environment['NODE_ENV']) || 'development'
};
```

### Supabase Configuration
```typescript
// src/config/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

// Service client for admin operations
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
```

### Authentication Service Structure
```typescript
@Service()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private supabaseClient = supabase
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    // Register user with Supabase Auth
    const { data: authData, error: authError } = await this.supabaseClient.auth.signUp({
      email: registerDto.email,
      password: registerDto.password,
      options: {
        data: {
          first_name: registerDto.first_name,
          last_name: registerDto.last_name
        }
      }
    });

    if (authError) {
      throw new AuthException(authError.message);
    }

    // Create user profile in our database
    const user = await this.userRepository.create({
      id: authData.user!.id,
      email: registerDto.email,
      first_name: registerDto.first_name,
      last_name: registerDto.last_name,
      role: UserRole.USER,
      status: UserStatus.PENDING_VERIFICATION
    });

    return {
      user: this.mapToUserResponse(user),
      session: authData.session
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    // Login with Supabase Auth
    const { data: authData, error: authError } = await this.supabaseClient.auth.signInWithPassword({
      email: loginDto.email,
      password: loginDto.password
    });

    if (authError) {
      throw new AuthException('Invalid credentials');
    }

    // Get user profile from our database
    const user = await this.userRepository.findById(authData.user!.id);
    if (!user) {
      throw new AuthException('User profile not found');
    }

    // Check user status
    if (user.status === UserStatus.SUSPENDED) {
      throw new AuthException('Account suspended');
    }

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    return {
      user: this.mapToUserResponse(user),
      session: authData.session
    };
  }

  async logout(accessToken: string): Promise<void> {
    const { error } = await this.supabaseClient.auth.signOut();
    if (error) {
      throw new AuthException('Logout failed');
    }
  }

  async refreshToken(refreshToken: string): Promise<SessionResponseDto> {
    const { data: authData, error } = await this.supabaseClient.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error) {
      throw new AuthException('Token refresh failed');
    }

    return {
      session: authData.session
    };
  }

  async resetPassword(email: string): Promise<void> {
    const { error } = await this.supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${env.FRONTEND_URL}/reset-password`
    });

    if (error) {
      throw new AuthException('Password reset failed');
    }
  }

  async updatePassword(accessToken: string, newPassword: string): Promise<void> {
    const { error } = await this.supabaseClient.auth.updateUser({
      password: newPassword
    });

    if (error) {
      throw new AuthException('Password update failed');
    }
  }

  async verifyUser(accessToken: string): Promise<UserEntity> {
    const { data: { user }, error } = await this.supabaseClient.auth.getUser(accessToken);
    
    if (error || !user) {
      throw new AuthException('Invalid token');
    }

    const userProfile = await this.userRepository.findById(user.id);
    if (!userProfile) {
      throw new AuthException('User profile not found');
    }

    return userProfile;
  }

  private mapToUserResponse(user: UserEntity): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  }
}
```

### Authentication DTOs
```typescript
export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RegisterDto {
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
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
  password: string;

  @IsString()
  @IsNotEmpty()
  @IsEqualTo('password')
  confirmPassword: string;
}

export class AuthResponseDto {
  user: UserResponseDto;
  session: Session | null;
}

export class SessionResponseDto {
  session: Session | null;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}
```

### Supabase Types
```typescript
import { Session, User } from '@supabase/supabase-js';

export interface SupabaseUser extends User {
  // Extended user properties from Supabase
}

export interface SupabaseSession extends Session {
  // Extended session properties from Supabase
}
```

## Definition of Done
- [ ] Supabase client properly configured with typed environment variables
- [ ] User registration works via Supabase Auth
- [ ] Login validates credentials through Supabase Auth
- [ ] Session management handled by Supabase
- [ ] Password reset functionality via Supabase Auth
- [ ] Email verification system working through Supabase
- [ ] All auth DTOs properly validated
- [ ] User profile sync between Supabase Auth and local database
- [ ] Authentication exceptions properly handled
- [ ] Sensitive data properly excluded from responses

## Testing Strategy
- [ ] Test user registration with valid/invalid data
- [ ] Verify login with correct/incorrect credentials
- [ ] Test Supabase session management
- [ ] Check refresh token functionality
- [ ] Test password reset flow
- [ ] Verify email verification process
- [ ] Test authentication error handling
- [ ] Check user profile sync between Supabase and local DB
- [ ] Test environment variable loading

## Dependencies
- TASK-005: User Model and Repository Implementation

## Notes
- Password hashing is handled by Supabase Auth
- JWT tokens are managed by Supabase (no custom implementation needed)
- Session management is handled by Supabase client
- Ensure proper error handling for Supabase API calls
- Keep user profile data in sync between Supabase Auth and local database
- Use typed environment variables instead of direct process.env access