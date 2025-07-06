import { IsEmail, IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";

export class CreateCustomerDto {
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase())
  email!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
