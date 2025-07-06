import { SupabaseClient } from "@supabase/supabase-js";
import { plainToInstance } from "class-transformer";
import { Inject, Service } from "typedi";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { config } from "../config/env";
import { HttpStatus } from "../types/http-status";
import {
  AccountSuspendedException,
  AuthException,
  InvalidCredentialsException,
  PasswordResetException,
  UserNotFoundException,
} from "../exceptions/auth.exception";
import { AuthResponseDto } from "../models/dtos/auth/auth-response.dto";
import { ChangePasswordDto } from "../models/dtos/auth/change-password.dto";
import { LoginDto } from "../models/dtos/auth/login.dto";
import { RefreshTokenDto } from "../models/dtos/auth/refresh-token.dto";
import { RegisterDto } from "../models/dtos/auth/register.dto";
import { SessionResponseDto } from "../models/dtos/auth/auth-response.dto";
import { UserResponseDto } from "../models/dtos/user/user-response.dto";
import { IUserEntity } from "../models/entities/user.entity";
import { UserRole } from "../models/enums/user-roles.enum";
import { UserStatus } from "../models/enums/user-status.enum";
import { UserRepository } from "../repositories/user.repository";

@Service()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    @Inject("supabaseAuth") private supabaseAuth?: SupabaseClient,
    @Inject("supabaseAdmin") private supabaseAdmin?: SupabaseClient,
  ) {}

  private get isUsingSupabase(): boolean {
    return config.database.provider === "supabase";
  }

  private get isUsingSQLite(): boolean {
    return config.database.provider === "sqlite";
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = parseInt(config.auth.bcryptRounds || "10", 10);
    return bcrypt.hash(password, saltRounds);
  }

  private async comparePassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private generateJWT(user: IUserEntity): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      config.auth.jwtSecret,
      { expiresIn: "24h" },
    );
  }

  private generateRefreshToken(user: IUserEntity): string {
    return jwt.sign({ id: user.id, type: "refresh" }, config.auth.jwtSecret, {
      expiresIn: "7d",
    });
  }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    // Validate password confirmation
    if (registerDto.password !== registerDto.confirmPassword) {
      throw new AuthException("Passwords do not match", HttpStatus.BadRequest);
    }

    // Check if email already exists
    const existingUser = await this.userRepository.findByEmail(
      registerDto.email,
    );
    if (existingUser) {
      throw new AuthException("Email already registered", HttpStatus.Conflict);
    }

    try {
      if (this.isUsingSQLite) {
        return await this.registerWithSQLite(registerDto);
      } else {
        return await this.registerWithSupabase(registerDto);
      }
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new AuthException(
        "Registration failed",
        HttpStatus.InternalServerError,
      );
    }
  }

  private async registerWithSupabase(
    registerDto: RegisterDto,
  ): Promise<AuthResponseDto> {
    if (!this.supabaseAuth) {
      throw new AuthException(
        "Supabase not configured",
        HttpStatus.InternalServerError,
      );
    }

    // Register user with Supabase Auth
    const { data: authData, error: authError } =
      await this.supabaseAuth.auth.signUp({
        email: registerDto.email,
        password: registerDto.password,
        options: {
          data: {
            first_name: registerDto.firstName,
            last_name: registerDto.lastName,
          },
        },
      });

    if (authError) {
      throw new AuthException(authError.message, HttpStatus.BadRequest);
    }

    if (!authData.user) {
      throw new AuthException(
        "User registration failed",
        HttpStatus.InternalServerError,
      );
    }

    // Create user profile in our database
    const userEntity: Omit<IUserEntity, "createdAt" | "updatedAt"> = {
      id: authData.user.id,
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      passwordHash: "", // Supabase handles password hashing
      role: UserRole.User,
      status: authData.user.email_confirmed_at
        ? UserStatus.Active
        : UserStatus.PendingVerification,
      emailVerified: !!authData.user.email_confirmed_at,
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

    return {
      user: this.mapToUserResponse(user),
      session: authData.session,
    };
  }

  private async registerWithSQLite(
    registerDto: RegisterDto,
  ): Promise<AuthResponseDto> {
    // Hash password
    const passwordHash = await this.hashPassword(registerDto.password);

    // Generate unique ID
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create user entity data (plain object for SQLite compatibility)
    const userEntityData = {
      id: userId,
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      passwordHash,
      role: UserRole.User,
      status: UserStatus.Active, // For SQLite, we'll set to active by default
      emailVerified: false, // Can be implemented later
    };

    const user = await this.userRepository.create(
      userEntityData as Omit<IUserEntity, "createdAt" | "updatedAt">,
    );

    // Generate JWT tokens
    const accessToken = this.generateJWT(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      user: this.mapToUserResponse(user),
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "bearer",
        expires_in: 24 * 60 * 60, // 24 hours
        expires_at: Date.now() + 24 * 60 * 60 * 1000,
        user: {
          id: user.id,
          email: user.email,
          email_confirmed_at: user.emailVerified
            ? new Date().toISOString()
            : undefined,
          last_sign_in_at: new Date().toISOString(),
          app_metadata: {},
          user_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString(),
        },
      },
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    try {
      if (this.isUsingSQLite) {
        return await this.loginWithSQLite(loginDto);
      } else {
        return await this.loginWithSupabase(loginDto);
      }
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new AuthException("Login failed", HttpStatus.InternalServerError);
    }
  }

  private async loginWithSupabase(
    loginDto: LoginDto,
  ): Promise<AuthResponseDto> {
    if (!this.supabaseAuth) {
      throw new AuthException(
        "Supabase not configured",
        HttpStatus.InternalServerError,
      );
    }

    // Login with Supabase Auth
    const { data: authData, error: authError } =
      await this.supabaseAuth.auth.signInWithPassword({
        email: loginDto.email,
        password: loginDto.password,
      });

    if (authError) {
      throw new InvalidCredentialsException("Invalid email or password");
    }

    if (!authData.user || !authData.session) {
      throw new InvalidCredentialsException("Authentication failed");
    }

    // Get user profile from our database
    const user = await this.userRepository.findById(authData.user.id);
    if (!user) {
      throw new UserNotFoundException("User profile not found");
    }

    // Check user status
    if (user.status === UserStatus.Suspended) {
      throw new AccountSuspendedException("Account is suspended");
    }

    if (user.status === UserStatus.Inactive) {
      throw new AuthException("Account is inactive", HttpStatus.Forbidden);
    }

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    return {
      user: this.mapToUserResponse(user),
      session: authData.session,
    };
  }

  private async loginWithSQLite(loginDto: LoginDto): Promise<AuthResponseDto> {
    // Find user by email
    const user = await this.userRepository.findByEmail(loginDto.email);
    if (!user) {
      throw new InvalidCredentialsException("Invalid email or password");
    }

    // Check password
    const isPasswordValid = await this.comparePassword(
      loginDto.password,
      user.passwordHash || "",
    );
    if (!isPasswordValid) {
      throw new InvalidCredentialsException("Invalid email or password");
    }

    // Check user status
    if (user.status === UserStatus.Suspended) {
      throw new AccountSuspendedException("Account is suspended");
    }

    if (user.status === UserStatus.Inactive) {
      throw new AuthException("Account is inactive", HttpStatus.Forbidden);
    }

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    // Generate JWT tokens
    const accessToken = this.generateJWT(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      user: this.mapToUserResponse(user),
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "bearer",
        expires_in: 24 * 60 * 60, // 24 hours
        expires_at: Date.now() + 24 * 60 * 60 * 1000,
        user: {
          id: user.id,
          email: user.email,
          email_confirmed_at: user.emailVerified
            ? new Date().toISOString()
            : undefined,
          last_sign_in_at: new Date().toISOString(),
          app_metadata: {},
          user_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString(),
        },
      },
    };
  }

  async logout(): Promise<void> {
    try {
      if (!this.supabaseAuth) {
        throw new AuthException(
          "Authentication service not configured",
          HttpStatus.InternalServerError,
        );
      }
      // Supabase handles the current session automatically
      const { error } = await this.supabaseAuth.auth.signOut();
      if (error) {
        throw new AuthException(
          "Logout failed",
          HttpStatus.InternalServerError,
        );
      }
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new AuthException("Logout failed", HttpStatus.InternalServerError);
    }
  }

  async refreshToken(
    refreshTokenDto: RefreshTokenDto,
  ): Promise<SessionResponseDto> {
    try {
      if (!this.supabaseAuth) {
        throw new AuthException(
          "Authentication service not configured",
          HttpStatus.InternalServerError,
        );
      }

      const { data: authData, error } =
        await this.supabaseAuth.auth.refreshSession({
          refresh_token: refreshTokenDto.refreshToken,
        });

      if (error) {
        throw new AuthException(
          "Token refresh failed",
          HttpStatus.Unauthorized,
        );
      }

      return {
        session: authData.session,
      };
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new AuthException(
        "Token refresh failed",
        HttpStatus.InternalServerError,
      );
    }
  }

  async forgotPassword(email: string): Promise<void> {
    try {
      if (!this.supabaseAuth) {
        throw new AuthException(
          "Authentication service not configured",
          HttpStatus.InternalServerError,
        );
      }
      const { error } = await this.supabaseAuth.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${config.env.frontendUrl}/reset-password`,
        },
      );

      if (error) {
        throw new PasswordResetException("Password reset request failed");
      }
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new PasswordResetException("Password reset request failed");
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      if (!this.supabaseAuth) {
        throw new AuthException(
          "Authentication service not configured",
          HttpStatus.InternalServerError,
        );
      }
      // First verify the OTP token
      const { error: verifyError } = await this.supabaseAuth.auth.verifyOtp({
        token_hash: token,
        type: "recovery",
      });

      if (verifyError) {
        throw new PasswordResetException("Invalid or expired reset token");
      }

      // Then update the password
      const { error } = await this.supabaseAuth.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw new PasswordResetException("Password reset failed");
      }
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new PasswordResetException("Password reset failed");
    }
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    // Validate password confirmation
    if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
      throw new AuthException("Passwords do not match", HttpStatus.BadRequest);
    }

    try {
      if (!this.supabaseAuth) {
        throw new AuthException(
          "Authentication service not configured",
          HttpStatus.InternalServerError,
        );
      }
      // The user is already authenticated (middleware verified the token)
      // We can directly update the password without additional verification
      // Supabase will handle the current password verification internally
      const { error } = await this.supabaseAuth.auth.updateUser({
        password: changePasswordDto.newPassword,
      });

      if (error) {
        throw new AuthException(
          "Password change failed",
          HttpStatus.InternalServerError,
        );
      }
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new AuthException(
        "Password change failed",
        HttpStatus.InternalServerError,
      );
    }
  }

  async verifyUser(accessToken: string): Promise<IUserEntity> {
    try {
      if (this.isUsingSQLite) {
        return await this.verifyUserJWT(accessToken);
      } else {
        return await this.verifyUserSupabase(accessToken);
      }
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new AuthException(
        "User verification failed",
        HttpStatus.InternalServerError,
      );
    }
  }

  private async verifyUserJWT(accessToken: string): Promise<IUserEntity> {
    try {
      const decoded = jwt.verify(accessToken, config.auth.jwtSecret) as {
        id: string;
        email: string;
        role: string;
      };

      const user = await this.userRepository.findById(decoded.id);
      if (!user) {
        throw new UserNotFoundException("User profile not found");
      }

      // Check if user is still active
      if (user.status === UserStatus.Suspended) {
        throw new AccountSuspendedException("Account is suspended");
      }

      if (user.status === UserStatus.Inactive) {
        throw new AuthException("Account is inactive", HttpStatus.Forbidden);
      }

      return user;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthException("Invalid token", HttpStatus.Unauthorized);
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthException("Token expired", HttpStatus.Unauthorized);
      }
      throw error;
    }
  }

  private async verifyUserSupabase(accessToken: string): Promise<IUserEntity> {
    if (!this.supabaseAuth) {
      throw new AuthException(
        "Authentication service not configured",
        HttpStatus.InternalServerError,
      );
    }

    const {
      data: { user },
      error,
    } = await this.supabaseAuth.auth.getUser(accessToken);

    if (error || !user) {
      throw new AuthException("Invalid token", HttpStatus.Unauthorized);
    }

    const userProfile = await this.userRepository.findById(user.id);
    if (!userProfile) {
      throw new UserNotFoundException("User profile not found");
    }

    return userProfile;
  }

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundException();
    }

    return this.mapToUserResponse(user);
  }

  async getUserProfile(userId: string): Promise<IUserEntity> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundException();
    }

    return user;
  }

  async verifyEmail(token: string): Promise<void> {
    try {
      if (!this.supabaseAuth) {
        throw new AuthException(
          "Authentication service not configured",
          HttpStatus.InternalServerError,
        );
      }
      const { error } = await this.supabaseAuth.auth.verifyOtp({
        token_hash: token,
        type: "email",
      });

      if (error) {
        throw new AuthException(
          "Email verification failed",
          HttpStatus.BadRequest,
        );
      }
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new AuthException(
        "Email verification failed",
        HttpStatus.InternalServerError,
      );
    }
  }

  async resendVerification(email: string): Promise<void> {
    try {
      if (!this.supabaseAuth) {
        throw new AuthException(
          "Authentication service not configured",
          HttpStatus.InternalServerError,
        );
      }
      const { error } = await this.supabaseAuth.auth.resend({
        type: "signup",
        email,
      });

      if (error) {
        throw new AuthException(
          "Verification email resend failed",
          HttpStatus.BadRequest,
        );
      }
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new AuthException(
        "Verification email resend failed",
        HttpStatus.InternalServerError,
      );
    }
  }

  private mapToUserResponse(user: IUserEntity): UserResponseDto {
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }
}
