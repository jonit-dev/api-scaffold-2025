import {
  JsonController,
  Post,
  Get,
  Body,
  HttpCode,
  Req,
  QueryParam,
} from "routing-controllers";
import { Service } from "typedi";
import { Request } from "express";
import { HttpStatus } from "../types/http-status";
import { AuthService } from "../services/auth.service";
import { LoginDto } from "../models/dtos/auth/login.dto";
import { RegisterDto } from "../models/dtos/auth/register.dto";
import { RefreshTokenDto } from "../models/dtos/auth/refresh-token.dto";
import { ForgotPasswordDto } from "../models/dtos/auth/forgot-password.dto";
import { ChangePasswordDto } from "../models/dtos/auth/change-password.dto";
import { ResendVerificationDto } from "../models/dtos/auth/resend-verification.dto";
import { VerifyEmailDto } from "../models/dtos/auth/verify-email.dto";
import { AuthResponseDto } from "../models/dtos/auth/auth-response.dto";
import { UserResponseDto } from "../models/dtos/user/user-response.dto";
import { Authenticated } from "../decorators/auth.decorator";
import { IAuthenticatedUser } from "../types/express";
import { RateLimit } from "../decorators/rate-limit.decorator";
import { authRateLimits } from "../middlewares/rate-limit.middleware";

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

  @Get("/me")
  @HttpCode(HttpStatus.Ok)
  @Authenticated()
  async getCurrentUser(
    @Req() req: Request,
  ): Promise<{ user: IAuthenticatedUser }> {
    const user = (req as Request & { user: IAuthenticatedUser }).user;
    return { user };
  }

  @Post("/logout")
  @HttpCode(HttpStatus.Ok)
  @Authenticated()
  async logout(): Promise<{ message: string }> {
    // For JWT tokens, logout is typically handled client-side
    // by removing the token from storage
    return { message: "Logged out successfully" };
  }

  @Get("/health")
  @HttpCode(HttpStatus.Ok)
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  @Post("/refresh")
  @HttpCode(HttpStatus.Ok)
  @RateLimit(authRateLimits.refresh)
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<AuthResponseDto> {
    return await this.authService.refreshToken(refreshTokenDto);
  }

  @Post("/forgot-password")
  @HttpCode(HttpStatus.Ok)
  @RateLimit(authRateLimits.forgotPassword)
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return await this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post("/change-password")
  @HttpCode(HttpStatus.Ok)
  @Authenticated()
  async changePassword(
    @Req() req: Request,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = (req as Request & { user: IAuthenticatedUser }).user;
    return await this.authService.changePassword(user.id, changePasswordDto);
  }

  @Post("/verify-email")
  @HttpCode(HttpStatus.Ok)
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
  ): Promise<{ success: boolean; message: string }> {
    return await this.authService.verifyEmail(verifyEmailDto.token);
  }

  @Get("/verify-email")
  @HttpCode(HttpStatus.Ok)
  async verifyEmailGet(
    @QueryParam("token", { required: true }) token: string,
  ): Promise<{ success: boolean; message: string }> {
    return await this.authService.verifyEmail(token);
  }

  @Post("/resend-verification")
  @HttpCode(HttpStatus.Ok)
  @RateLimit(authRateLimits.resendVerification)
  async resendVerification(
    @Body() resendVerificationDto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    return await this.authService.resendVerification(resendVerificationDto);
  }

  @Post("/verify-token")
  @HttpCode(HttpStatus.Ok)
  async verifyToken(
    @Body() body: { token: string },
  ): Promise<{ valid: boolean; user?: UserResponseDto }> {
    return await this.authService.verifyToken(body.token);
  }
}
