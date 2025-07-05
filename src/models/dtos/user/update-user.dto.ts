import {
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsUrl,
  IsBoolean,
  IsEmail,
} from "class-validator";
import { UserRole } from "../../enums/user-roles.enum";
import { UserStatus } from "../../enums/user-status.enum";

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @IsOptional()
  first_name?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @IsOptional()
  last_name?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @IsUrl()
  @IsOptional()
  avatar_url?: string;

  @IsBoolean()
  @IsOptional()
  email_verified?: boolean;
}
