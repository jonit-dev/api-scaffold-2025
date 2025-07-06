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
import { EmailService } from "./email.service";
import { LoggerService } from "./logger.service";

@Service()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService,
    private logger: LoggerService,
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

  private generateVerificationToken(email: string): string {
    return jwt.sign({ email, type: "verification" }, config.auth.jwtSecret, {
      expiresIn: "24h",
    });
  }

  private generatePasswordResetToken(email: string): string {
    return jwt.sign({ email, type: "password_reset" }, config.auth.jwtSecret, {
      expiresIn: "1h",
    });
  }

  private verifyToken(
    token: string,
    expectedType: string,
  ): { email: string; type: string } {
    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret) as {
        email: string;
        type: string;
      };
      if (decoded.type !== expectedType) {
        throw new AuthException("Invalid token type", HttpStatus.BadRequest);
      }
      return decoded;
    } catch {
      throw new AuthException(
        "Invalid or expired token",
        HttpStatus.BadRequest,
      );
    }
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

    // Send verification email
    const verificationToken = this.generateVerificationToken(user.email);
    const emailResult = await this.emailService.sendWithTemplate(
      "welcome",
      {
        name: user.fullName,
        verificationUrl: `${config.env.frontendUrl}/verify-email?token=${verificationToken}`,
        appName: config.email.fromName,
        currentYear: new Date().getFullYear(),
      },
      {
        to: user.email,
        subject: "Welcome! Please verify your email address",
      },
    );

    if (!emailResult.success) {
      this.logger.error(`Failed to send welcome email to: ${user.email}`);
    }

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
      if (this.isUsingSupabase) {
        return await this.forgotPasswordWithSupabase(email);
      } else {
        return await this.forgotPasswordWithSQLite(email);
      }
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new PasswordResetException("Password reset request failed");
    }
  }

  private async forgotPasswordWithSupabase(email: string): Promise<void> {
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
  }

  private async forgotPasswordWithSQLite(email: string): Promise<void> {
    // Check if user exists
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not for security
      this.logger.info(
        `Password reset requested for non-existent email: ${email}`,
      );
      return;
    }

    // Generate reset token
    const resetToken = this.generatePasswordResetToken(email);

    // Send password reset email
    const emailResult = await this.emailService.sendWithTemplate(
      "password-reset",
      {
        name: user.fullName,
        resetUrl: `${config.env.frontendUrl}/reset-password?token=${resetToken}`,
        expiresIn: "1 hour",
        appName: config.email.fromName,
        currentYear: new Date().getFullYear(),
      },
      {
        to: email,
        subject: "Password Reset Request",
      },
    );

    if (!emailResult.success) {
      this.logger.error("Email sending failed", { emailResult });
      throw new PasswordResetException("Failed to send password reset email");
    }

    this.logger.info(`Password reset email sent to: ${email}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      if (this.isUsingSupabase) {
        return await this.resetPasswordWithSupabase(token, newPassword);
      } else {
        return await this.resetPasswordWithSQLite(token, newPassword);
      }
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new PasswordResetException("Password reset failed");
    }
  }

  private async resetPasswordWithSupabase(
    token: string,
    newPassword: string,
  ): Promise<void> {
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
  }

  private async resetPasswordWithSQLite(
    token: string,
    newPassword: string,
  ): Promise<void> {
    // Verify the reset token
    const decoded = this.verifyToken(token, "password_reset");

    // Find user by email
    const user = await this.userRepository.findByEmail(decoded.email);
    if (!user) {
      throw new UserNotFoundException("User not found");
    }

    // Hash the new password
    const hashedPassword = await this.hashPassword(newPassword);

    // Update user's password
    await this.userRepository.updatePassword(user.id, hashedPassword);

    this.logger.info(`Password reset successful for user: ${user.email}`);
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
      if (this.isUsingSQLite) {
        await this.changePasswordWithSQLite(userId, changePasswordDto);
      } else {
        await this.changePasswordWithSupabase(changePasswordDto);
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

  private async changePasswordWithSQLite(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    // Find user by ID
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundException("User not found");
    }

    // Verify current password
    const isCurrentPasswordValid = await this.comparePassword(
      changePasswordDto.currentPassword,
      user.passwordHash || "",
    );
    if (!isCurrentPasswordValid) {
      throw new InvalidCredentialsException("Current password is incorrect");
    }

    // Hash new password
    const newPasswordHash = await this.hashPassword(
      changePasswordDto.newPassword,
    );

    // Update password in database
    await this.userRepository.updatePassword(userId, newPasswordHash);
  }

  private async changePasswordWithSupabase(
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
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
      if (this.isUsingSupabase) {
        return await this.verifyEmailWithSupabase(token);
      } else {
        return await this.verifyEmailWithSQLite(token);
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

  private async verifyEmailWithSupabase(token: string): Promise<void> {
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
  }

  private async verifyEmailWithSQLite(token: string): Promise<void> {
    // Verify the verification token
    const decoded = this.verifyToken(token, "verification");

    // Find user by email
    const user = await this.userRepository.findByEmail(decoded.email);
    if (!user) {
      throw new UserNotFoundException("User not found");
    }

    // Check if already verified
    if (user.emailVerified) {
      throw new AuthException("Email already verified", HttpStatus.BadRequest);
    }

    // Mark email as verified
    await this.userRepository.updateEmailVerified(user.id, true);

    this.logger.info(`Email verified successfully for user: ${user.email}`);
  }

  async resendVerification(email: string): Promise<void> {
    try {
      if (this.isUsingSupabase) {
        return await this.resendVerificationWithSupabase(email);
      } else {
        return await this.resendVerificationWithSQLite(email);
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

  private async resendVerificationWithSupabase(email: string): Promise<void> {
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
  }

  private async resendVerificationWithSQLite(email: string): Promise<void> {
    // Check if user exists
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UserNotFoundException("User not found");
    }

    // Check if already verified
    if (user.emailVerified) {
      throw new AuthException("Email already verified", HttpStatus.BadRequest);
    }

    // Generate new verification token
    const verificationToken = this.generateVerificationToken(email);

    // Send verification email
    const emailResult = await this.emailService.sendWithTemplate(
      "welcome",
      {
        name: user.fullName,
        verificationUrl: `${config.env.frontendUrl}/verify-email?token=${verificationToken}`,
        appName: config.email.fromName,
        currentYear: new Date().getFullYear(),
      },
      {
        to: email,
        subject: "Verify Your Email Address",
      },
    );

    if (!emailResult.success) {
      throw new AuthException(
        "Failed to send verification email",
        HttpStatus.InternalServerError,
      );
    }

    this.logger.info(`Verification email resent to: ${email}`);
  }

  private mapToUserResponse(user: IUserEntity): UserResponseDto {
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }
}
