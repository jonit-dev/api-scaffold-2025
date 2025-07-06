import { IBaseEntity } from "../../types/database.types";
import { UserRole } from "../enums/user-roles.enum";
import { UserStatus } from "../enums/user-status.enum";

export interface IUserEntity extends IBaseEntity {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  phone?: string;
  avatarUrl?: string;
  lastLogin?: string;
  stripeCustomerId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;

  // Computed properties
  get fullName(): string;
  isActive(): boolean;
  isAdmin(): boolean;
  isModerator(): boolean;
  hasRole(role: UserRole): boolean;
  hasAnyRole(...roles: UserRole[]): boolean;
}

export class UserEntity implements IUserEntity {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  phone?: string;
  avatarUrl?: string;
  lastLogin?: string;
  stripeCustomerId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;

  constructor(data: IUserEntity) {
    this.id = data.id;
    this.email = data.email;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.passwordHash = data.passwordHash;
    this.role = data.role;
    this.status = data.status;
    this.emailVerified = data.emailVerified;
    this.phone = data.phone;
    this.avatarUrl = data.avatarUrl;
    this.lastLogin = data.lastLogin;
    this.stripeCustomerId = data.stripeCustomerId;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.deletedAt = data.deletedAt;
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  isActive(): boolean {
    return this.status === UserStatus.Active;
  }

  isAdmin(): boolean {
    return this.role === UserRole.Admin;
  }

  isModerator(): boolean {
    return this.role === UserRole.Moderator;
  }

  hasRole(role: UserRole): boolean {
    return this.role === role;
  }

  hasAnyRole(...roles: UserRole[]): boolean {
    return roles.includes(this.role);
  }

  get isEmailVerified(): boolean {
    return this.emailVerified;
  }

  get isSuspended(): boolean {
    return this.status === UserStatus.Suspended;
  }
}
