import { IBaseEntity } from "../../types/database.types";
import { UserRole } from "../enums/user-roles.enum";
import { UserStatus } from "../enums/user-status.enum";

export interface IUserEntity extends IBaseEntity {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  email_verified: boolean;
  phone?: string;
  avatar_url?: string;
  last_login?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;

  // Computed properties
  get full_name(): string;
  isActive(): boolean;
  isAdmin(): boolean;
  isModerator(): boolean;
  hasRole(role: UserRole): boolean;
  hasAnyRole(...roles: UserRole[]): boolean;
}

export class UserEntity implements IUserEntity {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  email_verified: boolean;
  phone?: string;
  avatar_url?: string;
  last_login?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;

  constructor(data: IUserEntity) {
    this.id = data.id;
    this.email = data.email;
    this.first_name = data.first_name;
    this.last_name = data.last_name;
    this.password_hash = data.password_hash;
    this.role = data.role;
    this.status = data.status;
    this.email_verified = data.email_verified;
    this.phone = data.phone;
    this.avatar_url = data.avatar_url;
    this.last_login = data.last_login;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.deleted_at = data.deleted_at;
  }

  get full_name(): string {
    return `${this.first_name} ${this.last_name}`;
  }

  isActive(): boolean {
    return this.status === UserStatus.ACTIVE;
  }

  isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }

  isModerator(): boolean {
    return this.role === UserRole.MODERATOR;
  }

  hasRole(role: UserRole): boolean {
    return this.role === role;
  }

  hasAnyRole(...roles: UserRole[]): boolean {
    return roles.includes(this.role);
  }

  get isEmailVerified(): boolean {
    return this.email_verified;
  }

  get isSuspended(): boolean {
    return this.status === UserStatus.SUSPENDED;
  }
}
