import { Exclude, Expose, Transform } from "class-transformer";
import { UserRole } from "../../enums/user-roles.enum";
import { UserStatus } from "../../enums/user-status.enum";

export class UserResponseDto {
  @Expose()
  id!: string;

  @Expose()
  email!: string;

  @Expose()
  first_name!: string;

  @Expose()
  last_name!: string;

  @Expose()
  role!: UserRole;

  @Expose()
  status!: UserStatus;

  @Expose()
  email_verified!: boolean;

  @Expose()
  phone?: string;

  @Expose()
  avatar_url?: string;

  @Expose()
  @Transform(({ value }) => (value ? new Date(value) : null))
  last_login?: Date;

  @Expose()
  @Transform(({ value }) => new Date(value))
  created_at!: Date;

  @Expose()
  @Transform(({ value }) => new Date(value))
  updated_at!: Date;

  @Expose()
  @Transform(({ obj }) => `${obj.first_name} ${obj.last_name}`)
  full_name!: string;

  // Exclude sensitive fields
  @Exclude()
  password_hash!: string;

  @Exclude()
  deleted_at?: string;
}
