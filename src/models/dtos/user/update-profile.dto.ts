import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsPhoneNumber,
  IsUrl,
} from "class-validator";

export class UpdateProfileDto {
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

  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @IsUrl()
  @IsOptional()
  avatar_url?: string;
}
