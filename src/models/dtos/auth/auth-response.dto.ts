import { UserResponseDto } from "./user-response.dto";
import { Session } from "@supabase/supabase-js";
import { IsString, IsNotEmpty, IsEmail } from "class-validator";

export class AuthResponseDto {
  user!: UserResponseDto;
  session!: Session | null;
}

export class SessionResponseDto {
  session!: Session | null;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refresh_token!: string;
}

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class ResendVerificationDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
