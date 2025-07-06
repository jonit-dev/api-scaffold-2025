import {
  JsonController,
  Post,
  Get,
  Body,
  HttpCode,
  Req,
} from "routing-controllers";
import { Service } from "typedi";
import { Request } from "express";
import { HttpStatus } from "../types/http-status";
import { AuthService } from "../services/auth.service";
import { LoginDto } from "@models/dtos/auth/login.dto";
import { RegisterDto } from "@models/dtos/auth/register.dto";
import { ChangePasswordDto } from "@models/dtos/auth/change-password.dto";
import { AuthResponseDto } from "@models/dtos/auth/auth-response.dto";
import { RefreshTokenDto } from "@models/dtos/auth/refresh-token.dto";
import { VerifyEmailDto } from "@models/dtos/auth/verify-email.dto";
import { ResendVerificationDto } from "@models/dtos/auth/resend-verification.dto";
import { ForgotPasswordDto } from "@models/dtos/auth/forgot-password.dto";
import { UserResponseDto } from "@models/dtos/user/user-response.dto";
import { Authenticated } from "../decorators/auth.decorator";
import { RateLimit } from "../decorators/rate-limit.decorator";
import { authRateLimits } from "../middlewares/rate-limit.middleware";
import { IAuthenticatedUser } from "../types/express";
import { extractBearerTokenOrThrow } from "../utils/auth.utils";

@JsonController("/auth")
@Service()
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("/register")
  @HttpCode(HttpStatus.Created)
  @RateLimit(authRateLimits.register)
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return await this.authService.register(registerDto);
  }

  @Post("/login")
  @HttpCode(HttpStatus.Ok)
  @RateLimit(authRateLimits.login)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return await this.authService.login(loginDto);
  }

  @Post("/logout")
  @HttpCode(HttpStatus.NoContent)
  @Authenticated()
  async logout(): Promise<void> {
    await this.authService.logout();
  }

  @Post("/refresh")
  @HttpCode(HttpStatus.Ok)
  @RateLimit(authRateLimits.refresh)
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<object> {
    return await this.authService.refreshToken(refreshTokenDto);
  }

  @Post("/forgot-password")
  @HttpCode(HttpStatus.Ok)
  @RateLimit(authRateLimits.forgotPassword)
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.forgotPassword(forgotPasswordDto.email);
    return { message: "Password reset email sent successfully" };
  }

  @Post("/change-password")
  @HttpCode(HttpStatus.Ok)
  @Authenticated()
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: Request & { user: IAuthenticatedUser },
  ): Promise<{ message: string }> {
    await this.authService.changePassword(req.user.id, changePasswordDto);
    return { message: "Password changed successfully" };
  }

  @Post("/verify-email")
  @HttpCode(HttpStatus.Ok)
  @RateLimit(authRateLimits.emailVerification)
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
  ): Promise<{ message: string }> {
    await this.authService.verifyEmail(verifyEmailDto.token);
    return { message: "Email verified successfully" };
  }

  @Post("/resend-verification")
  @HttpCode(HttpStatus.Ok)
  @RateLimit(authRateLimits.resendVerification)
  async resendVerification(
    @Body() resendVerificationDto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    await this.authService.resendVerification(resendVerificationDto.email);
    return { message: "Verification email sent successfully" };
  }

  @Get("/me")
  @HttpCode(HttpStatus.Ok)
  @Authenticated()
  async getCurrentUser(
    @Req() req: Request & { user: IAuthenticatedUser },
  ): Promise<UserResponseDto> {
    return await this.authService.getCurrentUser(req.user.id);
  }

  @Post("/verify-token")
  @HttpCode(HttpStatus.Ok)
  async verifyToken(
    @Req() req: Request,
  ): Promise<{ valid: boolean; user?: UserResponseDto }> {
    try {
      const token = extractBearerTokenOrThrow(req);
      const user = await this.authService.verifyUser(token);
      const userResponse = await this.authService.getCurrentUser(user.id);
      return {
        valid: true,
        user: userResponse,
      };
    } catch {
      return { valid: false };
    }
  }

  @Get("/health")
  @HttpCode(HttpStatus.Ok)
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
    };
  }
}
