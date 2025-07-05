# TASK-008: Supabase Authentication Controller and API Endpoints

## Epic

Authentication & Authorization

## Story Points

4

## Priority

High

## Description

Create authentication controller that wraps Supabase authentication with endpoints for user registration, login, logout, session refresh, password reset, and email verification.

## Acceptance Criteria

### ✅ Authentication Controller

- [ ] Create `src/controllers/auth.controller.ts`
- [ ] Implement registration endpoint (`POST /api/auth/register`) via Supabase
- [ ] Create login endpoint (`POST /api/auth/login`) via Supabase
- [ ] Add logout endpoint (`POST /api/auth/logout`) via Supabase
- [ ] Implement session refresh endpoint (`POST /api/auth/refresh`) via Supabase
- [ ] Add password reset request endpoint (`POST /api/auth/forgot-password`) via Supabase
- [ ] Create password update endpoint (`PUT /api/auth/update-password`) via Supabase
- [ ] Add user profile endpoint (`GET /api/auth/me`) with local database sync

### ✅ Request Validation

- [ ] Add proper validation to all endpoints
- [ ] Implement rate limiting for auth endpoints
- [ ] Add input sanitization
- [ ] Validate email formats and password strength
- [ ] Implement CSRF protection if needed

### ✅ Response Formatting

- [ ] Create consistent response format for all endpoints
- [ ] Implement proper error responses
- [ ] Add success/failure status indicators
- [ ] Include appropriate HTTP status codes
- [ ] Exclude sensitive data from responses

### ✅ Security Measures

- [ ] Add rate limiting for login attempts
- [ ] Implement account lockout after failed attempts
- [ ] Add password attempt logging
- [ ] Implement secure password reset tokens
- [ ] Add email verification token security

## Technical Requirements

### Authentication Controller Structure

```typescript
@JsonController("/api/auth")
@Service()
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("/register")
  @UseBefore(RateLimitMiddleware({ max: 5, windowMs: 15 * 60 * 1000 }))
  async register(
    @Body() registerDto: RegisterDto
  ): Promise<ApiResponse<AuthResponseDto>> {
    const result = await this.authService.register(registerDto);

    return {
      success: true,
      message:
        "User registered successfully. Please check your email for verification.",
      data: result,
    };
  }

  @Post("/login")
  @UseBefore(RateLimitMiddleware({ max: 10, windowMs: 15 * 60 * 1000 }))
  async login(
    @Body() loginDto: LoginDto
  ): Promise<ApiResponse<AuthResponseDto>> {
    const result = await this.authService.login(loginDto);

    return {
      success: true,
      message: "Login successful",
      data: result,
    };
  }

  @Post("/logout")
  @Authenticated()
  async logout(@CurrentUser() user: JwtPayload): Promise<ApiResponse<void>> {
    await this.authService.logout(user.userId);

    return {
      success: true,
      message: "Logout successful",
    };
  }

  @Post("/refresh")
  @UseBefore(RateLimitMiddleware({ max: 20, windowMs: 15 * 60 * 1000 }))
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto
  ): Promise<ApiResponse<TokenResponseDto>> {
    const result = await this.authService.refreshToken(refreshTokenDto);

    return {
      success: true,
      message: "Token refreshed successfully",
      data: result,
    };
  }

  @Post("/forgot-password")
  @UseBefore(RateLimitMiddleware({ max: 3, windowMs: 15 * 60 * 1000 }))
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto
  ): Promise<ApiResponse<void>> {
    await this.authService.forgotPassword(forgotPasswordDto.email);

    return {
      success: true,
      message: "Password reset email sent if account exists",
    };
  }

  @Post("/reset-password")
  @UseBefore(RateLimitMiddleware({ max: 5, windowMs: 15 * 60 * 1000 }))
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto
  ): Promise<ApiResponse<void>> {
    await this.authService.resetPassword(resetPasswordDto);

    return {
      success: true,
      message: "Password reset successful",
    };
  }

  @Post("/verify-email")
  @UseBefore(RateLimitMiddleware({ max: 10, windowMs: 15 * 60 * 1000 }))
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto
  ): Promise<ApiResponse<void>> {
    await this.authService.verifyEmail(verifyEmailDto.token);

    return {
      success: true,
      message: "Email verified successfully",
    };
  }

  @Post("/resend-verification")
  @UseBefore(RateLimitMiddleware({ max: 3, windowMs: 15 * 60 * 1000 }))
  async resendVerification(
    @Body() resendVerificationDto: ResendVerificationDto
  ): Promise<ApiResponse<void>> {
    await this.authService.resendVerification(resendVerificationDto.email);

    return {
      success: true,
      message: "Verification email sent if account exists",
    };
  }

  @Get("/me")
  @Authenticated()
  async getCurrentUser(
    @CurrentUser() user: JwtPayload
  ): Promise<ApiResponse<UserResponseDto>> {
    const result = await this.authService.getCurrentUser(user.userId);

    return {
      success: true,
      message: "User profile retrieved successfully",
      data: result,
    };
  }

  @Put("/change-password")
  @Authenticated()
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() changePasswordDto: ChangePasswordDto
  ): Promise<ApiResponse<void>> {
    await this.authService.changePassword(user.userId, changePasswordDto);

    return {
      success: true,
      message: "Password changed successfully",
    };
  }
}
```

### Additional DTOs

```typescript
export class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
  password: string;

  @IsString()
  @IsNotEmpty()
  @IsEqualTo("password")
  confirmPassword: string;
}

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class ResendVerificationDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  @IsEqualTo("newPassword")
  confirmPassword: string;
}
```

### API Response Format

```typescript
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp?: Date;
}

export class ApiResponseDto<T> implements ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp: Date;

  constructor(success: boolean, message: string, data?: T, error?: string) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.error = error;
    this.timestamp = new Date();
  }
}
```

### Rate Limiting Configuration

```typescript
export const authRateLimits = {
  register: {
    max: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: "Too many registration attempts, please try again later",
  },
  login: {
    max: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: "Too many login attempts, please try again later",
  },
  forgotPassword: {
    max: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: "Too many password reset requests, please try again later",
  },
  refresh: {
    max: 20,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: "Too many token refresh attempts, please try again later",
  },
};
```

## Definition of Done

- [ ] All authentication endpoints functional
- [ ] Request validation working correctly
- [ ] Rate limiting implemented for all endpoints
- [ ] Proper HTTP status codes returned
- [ ] Error handling comprehensive
- [ ] Response format consistent across endpoints
- [ ] Security measures implemented
- [ ] Sensitive data excluded from responses
- [ ] Authentication middleware integration working

## Testing Strategy

- [ ] Test all endpoints with valid/invalid data
- [ ] Verify rate limiting behavior
- [ ] Test authentication middleware integration
- [ ] Check error response formats
- [ ] Verify password security measures
- [ ] Test token refresh functionality
- [ ] Check email verification flow
- [ ] Test password reset flow

## Dependencies

- TASK-007: Authentication Middleware and Route Protection
- TASK-006: Authentication Service and JWT Implementation

## Notes

- Implement proper logging for all authentication events
- Consider implementing CAPTCHA for registration/login
- Ensure rate limiting doesn't affect legitimate users
- Keep error messages consistent and secure
- Test all endpoints thoroughly before deployment
