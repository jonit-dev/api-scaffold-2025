import { Exclude, Expose, Transform } from "class-transformer";
import { UserRole } from "../../enums/user-roles.enum";
import { UserStatus } from "../../enums/user-status.enum";

export class UserResponseDto {
  @Expose()
  id!: string;

  @Expose()
  email!: string;

  @Expose()
  firstName!: string;

  @Expose()
  lastName!: string;

  @Expose()
  role!: UserRole;

  @Expose()
  status!: UserStatus;

  @Expose()
  emailVerified!: boolean;

  @Expose()
  phone?: string;

  @Expose()
  avatarUrl?: string;

  @Expose()
  stripeCustomerId?: string;

  @Expose()
  @Transform(({ value }) => (value ? new Date(value) : null))
  lastLogin?: Date;

  @Expose()
  @Transform(({ value }) => new Date(value))
  createdAt!: Date;

  @Expose()
  @Transform(({ value }) => new Date(value))
  updatedAt!: Date;

  @Expose()
  @Transform(({ obj }) => `${obj.firstName} ${obj.lastName}`)
  fullName!: string;

  // Exclude sensitive fields
  @Exclude()
  passwordHash?: string;

  @Exclude()
  deletedAt?: string;
}
