import { SupabaseClient } from "@supabase/supabase-js";
import { plainToInstance } from "class-transformer";
import { Inject, Service } from "typedi";
import { env } from "../config/env";
import {
  AccountSuspendedException,
  AuthException,
  InvalidCredentialsException,
  PasswordResetException,
  UserNotFoundException,
} from "../exceptions/auth.exception";
import {
  AuthResponseDto,
  ChangePasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  SessionResponseDto,
} from "../models/dtos/auth";
import { UserResponseDto } from "../models/dtos/user";
import { IUserEntity } from "../models/entities/user.entity";
import { UserRole } from "../models/enums/user-roles.enum";
import { UserStatus } from "../models/enums/user-status.enum";
import { UserRepository } from "../repositories/user.repository";

@Service()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    @Inject("supabaseAuth") private supabaseAuth: SupabaseClient,
    @Inject("supabaseAdmin") private supabaseAdmin: SupabaseClient,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    // Validate password confirmation
    if (registerDto.password !== registerDto.confirmPassword) {
      throw new AuthException("Passwords do not match", 400);
    }

    // Check if email already exists
    const existingUser = await this.userRepository.findByEmail(
      registerDto.email,
    );
    if (existingUser) {
      throw new AuthException("Email already registered", 409);
    }

    try {
      // Register user with Supabase Auth
      const { data: authData, error: authError } =
        await this.supabaseAuth.auth.signUp({
          email: registerDto.email,
          password: registerDto.password,
          options: {
            data: {
              first_name: registerDto.first_name,
              last_name: registerDto.last_name,
            },
          },
        });

      if (authError) {
        throw new AuthException(authError.message, 400);
      }

      if (!authData.user) {
        throw new AuthException("User registration failed", 500);
      }

      // Create user profile in our database
      const userEntity: Omit<IUserEntity, "created_at" | "updated_at"> = {
        id: authData.user.id,
        email: registerDto.email,
        first_name: registerDto.first_name,
        last_name: registerDto.last_name,
        password_hash: "", // Supabase handles password hashing
        role: UserRole.USER,
        status: authData.user.email_confirmed_at
          ? UserStatus.ACTIVE
          : UserStatus.PENDING_VERIFICATION,
        email_verified: !!authData.user.email_confirmed_at,
        get full_name() {
          return `${this.first_name} ${this.last_name}`;
        },
        isActive() {
          return this.status === UserStatus.ACTIVE;
        },
        isAdmin() {
          return this.role === UserRole.ADMIN;
        },
        isModerator() {
          return this.role === UserRole.MODERATOR;
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
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new AuthException("Registration failed", 500);
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    try {
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
      if (user.status === UserStatus.SUSPENDED) {
        throw new AccountSuspendedException("Account is suspended");
      }

      if (user.status === UserStatus.INACTIVE) {
        throw new AuthException("Account is inactive", 403);
      }

      // Update last login
      await this.userRepository.updateLastLogin(user.id);

      return {
        user: this.mapToUserResponse(user),
        session: authData.session,
      };
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new AuthException("Login failed", 500);
    }
  }

  async logout(accessToken: string): Promise<void> {
    try {
      // Set the session to make sure we're authenticated
      await this.supabaseAuth.auth.setSession({
        access_token: accessToken,
        refresh_token: "", // Will be ignored for logout
      });

      const { error } = await this.supabaseAuth.auth.signOut();
      if (error) {
        throw new AuthException("Logout failed", 500);
      }
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new AuthException("Logout failed", 500);
    }
  }

  async refreshToken(
    refreshTokenDto: RefreshTokenDto,
  ): Promise<SessionResponseDto> {
    try {
      const { data: authData, error } =
        await this.supabaseAuth.auth.refreshSession({
          refresh_token: refreshTokenDto.refresh_token,
        });

      if (error) {
        throw new AuthException("Token refresh failed", 401);
      }

      return {
        session: authData.session,
      };
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new AuthException("Token refresh failed", 500);
    }
  }

  async forgotPassword(email: string): Promise<void> {
    try {
      const { error } = await this.supabaseAuth.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${env.FRONTEND_URL}/reset-password`,
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
      throw new AuthException("Passwords do not match", 400);
    }

    try {
      // Verify current password by attempting to sign in
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new UserNotFoundException();
      }

      const { error: signInError } =
        await this.supabaseAuth.auth.signInWithPassword({
          email: user.email,
          password: changePasswordDto.currentPassword,
        });

      if (signInError) {
        throw new AuthException("Current password is incorrect", 400);
      }

      // Update password
      const { error } = await this.supabaseAuth.auth.updateUser({
        password: changePasswordDto.newPassword,
      });

      if (error) {
        throw new AuthException("Password change failed", 500);
      }
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new AuthException("Password change failed", 500);
    }
  }

  async verifyUser(accessToken: string): Promise<IUserEntity> {
    try {
      const {
        data: { user },
        error,
      } = await this.supabaseAuth.auth.getUser(accessToken);

      if (error || !user) {
        throw new AuthException("Invalid token", 401);
      }

      const userProfile = await this.userRepository.findById(user.id);
      if (!userProfile) {
        throw new UserNotFoundException("User profile not found");
      }

      return userProfile;
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new AuthException("User verification failed", 500);
    }
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
      const { error } = await this.supabaseAuth.auth.verifyOtp({
        token_hash: token,
        type: "email",
      });

      if (error) {
        throw new AuthException("Email verification failed", 400);
      }
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new AuthException("Email verification failed", 500);
    }
  }

  async resendVerification(email: string): Promise<void> {
    try {
      const { error } = await this.supabaseAuth.auth.resend({
        type: "signup",
        email,
      });

      if (error) {
        throw new AuthException("Verification email resend failed", 400);
      }
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new AuthException("Verification email resend failed", 500);
    }
  }

  private mapToUserResponse(user: IUserEntity): UserResponseDto {
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }
}
