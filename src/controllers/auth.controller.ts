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
import { AuthService } from "../services/auth.service";
import {
  LoginDto,
  RegisterDto,
  ChangePasswordDto,
  AuthResponseDto,
  RefreshTokenDto,
  VerifyEmailDto,
  ResendVerificationDto,
} from "../models/dtos/auth";
import { ForgotPasswordDto } from "../models/dtos/auth/forgot-password.dto";
import { UserResponseDto } from "../models/dtos/auth/user-response.dto";
import { Authenticated } from "../decorators/auth.decorator";
import { IAuthenticatedUser } from "../types/express";

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
    @Req() req: Request & { user: IAuthenticatedUser }
  ): Promise<void> {
    const token = this.extractTokenFromRequest(req);
    await this.authService.logout(token);
  }

  @Post("/refresh")
  @HttpCode(200)
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto
  ): Promise<object> {
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
    @Req() req: Request & { user: IAuthenticatedUser }
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
    @Req() req: Request & { user: IAuthenticatedUser }
  ): Promise<UserResponseDto> {
    return await this.authService.getCurrentUser(req.user.id);
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
