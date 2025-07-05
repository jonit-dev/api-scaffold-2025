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

### Authentication Service Structure
```typescript
@Service()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    // Check if user exists
    const existingUser = await this.userRepository.findByEmail(registerDto.email);
    if (existingUser) {
      throw new AuthException('User already exists');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(registerDto.password);

    // Create user
    const user = await this.userRepository.create({
      ...registerDto,
      password_hash: hashedPassword,
      status: UserStatus.PENDING_VERIFICATION
    });

    // Generate verification token
    const verificationToken = this.generateVerificationToken(user.id);
    
    // Send verification email
    await this.emailService.sendVerificationEmail(user.email, verificationToken);

    // Generate JWT tokens
    const tokens = this.generateTokens(user);

    return {
      user: this.mapToUserResponse(user),
      tokens
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    // Find user by email
    const user = await this.userRepository.findByEmail(loginDto.email);
    if (!user) {
      throw new AuthException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(loginDto.password, user.password_hash);
    if (!isPasswordValid) {
      throw new AuthException('Invalid credentials');
    }

    // Check user status
    if (user.status === UserStatus.SUSPENDED) {
      throw new AuthException('Account suspended');
    }

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    // Generate tokens
    const tokens = this.generateTokens(user);

    return {
      user: this.mapToUserResponse(user),
      tokens
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<TokenResponseDto> {
    const { refreshToken } = refreshTokenDto;
    
    // Verify refresh token
    const payload = this.verifyToken(refreshToken, 'refresh');
    
    // Find user
    const user = await this.userRepository.findById(payload.userId);
    if (!user) {
      throw new AuthException('Invalid refresh token');
    }

    // Generate new tokens
    return this.generateTokens(user);
  }

  private generateTokens(user: UserEntity): TokenResponseDto {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn
    });

    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: config.jwt.expiresIn
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  private async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
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
  tokens: TokenResponseDto;
}

export class TokenResponseDto {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: string;
}
```

### JWT Configuration
```typescript
export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'your-secret-key',
  expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
};
```

## Definition of Done
- [ ] User registration works with password hashing
- [ ] Login validates credentials and returns JWT tokens
- [ ] Refresh token mechanism functional
- [ ] Password reset functionality implemented
- [ ] Email verification system working
- [ ] All auth DTOs properly validated
- [ ] JWT tokens properly signed and verified
- [ ] Authentication exceptions properly handled
- [ ] Sensitive data properly excluded from responses

## Testing Strategy
- [ ] Test user registration with valid/invalid data
- [ ] Verify login with correct/incorrect credentials
- [ ] Test JWT token generation and validation
- [ ] Check refresh token functionality
- [ ] Test password hashing and comparison
- [ ] Verify email verification process
- [ ] Test authentication error handling
- [ ] Check token expiration behavior

## Dependencies
- TASK-005: User Model and Repository Implementation

## Notes
- Use strong password hashing (bcrypt with high salt rounds)
- Implement proper JWT token expiration
- Consider implementing token blacklist for logout
- Ensure sensitive operations are properly logged
- Keep JWT payloads minimal but sufficient