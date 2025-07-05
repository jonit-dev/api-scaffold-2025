import { IsNotEmpty, IsString, MinLength, Matches } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message:
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
  })
  password!: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword!: string;
}
