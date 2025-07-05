import {
  JsonController,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  Req,
  Res,
} from "routing-controllers";
import { Service } from "typedi";
import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  VerifyEmailDto,
  ResendVerificationDto,
  AuthResponseDto,
  UserResponseDto,
} from "../models/dtos/auth";
import { Authenticated, OptionalAuth } from "../decorators/auth.decorator";
import { AuthenticatedUser } from "../types/express";

@JsonController("/api/auth")
@Service()
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("/register")
  @HttpCode(201)
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return await this.authService.register(registerDto);
  }

  @Post("/login")
  @HttpCode(200)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return await this.authService.login(loginDto);
  }

  @Post("/logout")
  @HttpCode(204)
  @Authenticated()
  async logout(
    @Req() req: Request & { user: AuthenticatedUser }
  ): Promise<void> {
    const token = this.extractTokenFromRequest(req);
    await this.authService.logout(token);
  }

  @Post("/refresh")
  @HttpCode(200)
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto
  ): Promise<{ session: any }> {
    return await this.authService.refreshToken(refreshTokenDto);
  }

  @Post("/forgot-password")
  @HttpCode(200)
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto
  ): Promise<{ message: string }> {
    await this.authService.forgotPassword(forgotPasswordDto.email);
    return { message: "Password reset email sent successfully" };
  }

  @Post("/change-password")
  @HttpCode(200)
  @Authenticated()
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: Request & { user: AuthenticatedUser }
  ): Promise<{ message: string }> {
    await this.authService.changePassword(req.user.id, changePasswordDto);
    return { message: "Password changed successfully" };
  }

  @Post("/verify-email")
  @HttpCode(200)
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto
  ): Promise<{ message: string }> {
    await this.authService.verifyEmail(verifyEmailDto.token);
    return { message: "Email verified successfully" };
  }

  @Post("/resend-verification")
  @HttpCode(200)
  async resendVerification(
    @Body() resendVerificationDto: ResendVerificationDto
  ): Promise<{ message: string }> {
    await this.authService.resendVerification(resendVerificationDto.email);
    return { message: "Verification email sent successfully" };
  }

  @Get("/me")
  @HttpCode(200)
  @Authenticated()
  async getCurrentUser(
    @Req() req: Request & { user: AuthenticatedUser }
  ): Promise<UserResponseDto> {
    const userProfile = await this.authService.getCurrentUser(req.user.id);
    return {
      id: userProfile.id,
      email: userProfile.email,
      first_name: userProfile.first_name,
      last_name: userProfile.last_name,
      role: userProfile.role,
      status: userProfile.status,
      email_verified: userProfile.email_verified,
      phone: userProfile.phone,
      avatar_url: userProfile.avatar_url,
      last_login: userProfile.last_login,
      created_at: userProfile.created_at,
      updated_at: userProfile.updated_at,
      full_name: userProfile.full_name,
    };
  }

  @Post("/verify-token")
  @HttpCode(200)
  async verifyToken(
    @Req() req: Request
  ): Promise<{ valid: boolean; user?: UserResponseDto }> {
    try {
      const token = this.extractTokenFromRequest(req);
      if (!token) {
        return { valid: false };
      }

      const user = await this.authService.verifyUser(token);
      return {
        valid: true,
        user: {
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
          full_name: user.full_name,
        },
      };
    } catch (error) {
      return { valid: false };
    }
  }

  @Get("/health")
  @HttpCode(200)
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
    };
  }

  private extractTokenFromRequest(req: Request): string {
    const authorization = req.headers.authorization;
    if (!authorization) {
      throw new Error("No authorization header found");
    }

    const [type, token] = authorization.split(" ");
    if (type !== "Bearer" || !token) {
      throw new Error("Invalid authorization format");
    }

    return token;
  }
}
