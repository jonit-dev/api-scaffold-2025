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
import { LoginDto } from "../models/dtos/auth/login.dto";
import { RegisterDto } from "../models/dtos/auth/register.dto";
import { AuthResponseDto } from "../models/dtos/auth/auth-response.dto";
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
}
