import { plainToInstance } from "class-transformer";
import { Service } from "typedi";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { config } from "../config/env";
import { HttpStatus } from "../types/http-status";
import {
  AuthException,
  InvalidCredentialsException,
  UserNotFoundException,
} from "../exceptions/auth.exception";
import {
  AuthResponseDto,
  ISession,
} from "../models/dtos/auth/auth-response.dto";
import { LoginDto } from "../models/dtos/auth/login.dto";
import { RegisterDto } from "../models/dtos/auth/register.dto";
import { RefreshTokenDto } from "../models/dtos/auth/refresh-token.dto";
import { ForgotPasswordDto } from "../models/dtos/auth/forgot-password.dto";
import { ChangePasswordDto } from "../models/dtos/auth/change-password.dto";
import { ResendVerificationDto } from "../models/dtos/auth/resend-verification.dto";
import { UserResponseDto } from "../models/dtos/user/user-response.dto";
import { IUserEntity } from "../models/entities/user.entity";
import { UserRole } from "../models/enums/user-roles.enum";
import { UserStatus } from "../models/enums/user-status.enum";
import { UserRepository } from "../repositories/user.repository";
import { EmailService } from "./email.service";
import { LoggerService } from "./logger.service";

@Service()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService,
    private logger: LoggerService,
  ) {}

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = parseInt(config.auth.bcryptRounds || "10", 10);
    return bcrypt.hash(password, saltRounds);
  }

  private async verifyPassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private generateAccessToken(user: IUserEntity): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        type: "access",
      },
      config.auth.jwtSecret,
      { expiresIn: "1h" },
    );
  }

  private generateRefreshToken(user: IUserEntity): string {
    return jwt.sign(
      {
        sub: user.id,
        type: "refresh",
      },
      config.auth.jwtSecret,
      { expiresIn: "7d" },
    );
  }

  private generateVerificationToken(email: string): string {
    return jwt.sign({ email, type: "verification" }, config.auth.jwtSecret, {
      expiresIn: "24h",
    });
  }

  private mapToUserResponse(user: IUserEntity): UserResponseDto {
    return plainToInstance(UserResponseDto, {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(
      registerDto.email,
    );
    if (existingUser) {
      throw new AuthException("Email already registered", HttpStatus.Conflict);
    }

    // Hash password
    const passwordHash = await this.hashPassword(registerDto.password);

    // Create user data for database
    const userData = {
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      passwordHash,
      role: UserRole.User,
      status: UserStatus.PendingVerification,
      emailVerified: false,
      deletedAt: null,
    };

    const user = await this.userRepository.create(userData);

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    const session: ISession = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "Bearer",
      expires_at: Date.now() + 3600000, // 1 hour
      expires_in: 3600,
    };

    return {
      user: this.mapToUserResponse(user),
      session,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    // Find user by email
    const user = await this.userRepository.findByEmail(loginDto.email);
    if (!user) {
      throw new InvalidCredentialsException();
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(
      loginDto.password,
      user.passwordHash,
    );
    if (!isValidPassword) {
      throw new InvalidCredentialsException();
    }

    // Check if user is active
    if (user.status !== UserStatus.Active) {
      throw new AuthException("Account is not active", HttpStatus.Forbidden);
    }

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    const session: ISession = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "Bearer",
      expires_at: Date.now() + 3600000, // 1 hour
      expires_in: 3600,
    };

    return {
      user: this.mapToUserResponse(user),
      session,
    };
  }

  async logout(): Promise<void> {
    // With JWT tokens, logout is handled client-side by removing the token
    // In a more sophisticated setup, you might maintain a token blacklist
    return;
  }

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundException();
    }

    return this.mapToUserResponse(user);
  }

  async verifyUser(token: string): Promise<UserResponseDto> {
    try {
      const payload = jwt.verify(token, config.auth.jwtSecret) as {
        sub: string;
        type: string;
      };

      if (payload.type !== "access") {
        throw new AuthException("Invalid token type", HttpStatus.Unauthorized);
      }

      const user = await this.userRepository.findById(payload.sub);
      if (!user) {
        throw new UserNotFoundException();
      }

      return this.mapToUserResponse(user);
    } catch {
      throw new AuthException(
        "Invalid or expired token",
        HttpStatus.Unauthorized,
      );
    }
  }

  async getUserProfile(userId: string): Promise<UserResponseDto> {
    return this.getCurrentUser(userId);
  }

  async verifyEmail(
    token: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const payload = jwt.verify(token, config.auth.jwtSecret) as {
        email: string;
        type: string;
      };

      if (payload.type !== "verification") {
        throw new Error("Invalid token type");
      }

      const user = await this.userRepository.findByEmail(payload.email);
      if (!user) {
        throw new UserNotFoundException();
      }

      await this.userRepository.updateEmailVerified(user.id, true);

      return {
        success: true,
        message: "Email verified successfully",
      };
    } catch {
      return {
        success: false,
        message: "Invalid or expired verification token",
      };
    }
  }

  async refreshToken(
    refreshTokenDto: RefreshTokenDto,
  ): Promise<AuthResponseDto> {
    try {
      const decoded = jwt.verify(
        refreshTokenDto.refreshToken,
        config.auth.jwtSecret,
      ) as { sub: string; type: string };

      if (decoded.type !== "refresh") {
        throw new AuthException("Invalid token type", HttpStatus.Unauthorized);
      }

      const user = await this.userRepository.findById(decoded.sub);
      if (!user) {
        throw new UserNotFoundException("User not found");
      }

      if (user.status !== UserStatus.Active) {
        throw new AuthException("Account is not active", HttpStatus.Forbidden);
      }

      // Generate new tokens
      const accessToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      const session: ISession = {
        access_token: accessToken,
        refresh_token: newRefreshToken,
        token_type: "Bearer",
        expires_at: Date.now() + 3600 * 1000, // 1 hour
        expires_in: 3600,
      };

      return {
        user: this.mapToUserResponse(user),
        session,
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthException(
          "Invalid refresh token",
          HttpStatus.Unauthorized,
        );
      }
      throw error;
    }
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findByEmail(forgotPasswordDto.email);

    // Always return success to prevent email enumeration
    if (!user) {
      return {
        message: "If the email exists, a password reset link has been sent",
      };
    }

    // Generate password reset token (valid for 1 hour)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const resetToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        type: "password_reset",
      },
      config.auth.jwtSecret,
      { expiresIn: "1h" },
    );

    // TODO: Send password reset email
    // await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    return {
      message: "If the email exists, a password reset link has been sent",
    };
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundException("User not found");
    }

    // Verify current password
    const isCurrentPasswordValid = await this.verifyPassword(
      changePasswordDto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new InvalidCredentialsException("Current password is incorrect");
    }

    // Validate new password confirmation
    if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
      throw new AuthException(
        "New password and confirmation do not match",
        HttpStatus.BadRequest,
      );
    }

    // Hash new password
    const newPasswordHash = await this.hashPassword(
      changePasswordDto.newPassword,
    );

    // Update password in database
    await this.userRepository.updatePassword(userId, newPasswordHash);

    return { message: "Password changed successfully" };
  }

  async resendVerification(
    resendVerificationDto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findByEmail(
      resendVerificationDto.email,
    );

    // Always return success to prevent email enumeration
    if (!user) {
      return {
        message:
          "If the email exists and is unverified, a new verification email has been sent",
      };
    }

    if (user.emailVerified) {
      return { message: "Email is already verified" };
    }

    // Generate new verification token
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const verificationToken = this.generateVerificationToken(user.email);

    // TODO: Send verification email
    // await this.emailService.sendVerificationEmail(user.email, verificationToken);

    return {
      message:
        "If the email exists and is unverified, a new verification email has been sent",
    };
  }

  async verifyToken(
    token: string,
  ): Promise<{ valid: boolean; user?: UserResponseDto }> {
    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret) as {
        sub: string;
        type: string;
        email: string;
      };

      if (decoded.type !== "access") {
        return { valid: false };
      }

      const user = await this.userRepository.findById(decoded.sub);
      if (!user) {
        return { valid: false };
      }

      if (user.status !== UserStatus.Active) {
        return { valid: false };
      }

      return {
        valid: true,
        user: this.mapToUserResponse(user),
      };
    } catch {
      return { valid: false };
    }
  }
}
