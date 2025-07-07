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

    // Create user
    const userEntity: Omit<IUserEntity, "id" | "createdAt" | "updatedAt"> = {
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      passwordHash,
      role: UserRole.User,
      status: UserStatus.PendingVerification,
      emailVerified: false,
      get fullName() {
        return `${this.firstName} ${this.lastName}`;
      },
      isActive() {
        return this.status === UserStatus.Active;
      },
      isAdmin() {
        return this.role === UserRole.Admin;
      },
      isModerator() {
        return this.role === UserRole.Moderator;
      },
      hasRole(role: UserRole) {
        return this.role === role;
      },
      hasAnyRole(...roles: UserRole[]) {
        return roles.includes(this.role);
      },
    };

    const user = await this.userRepository.create(userEntity);

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
}
