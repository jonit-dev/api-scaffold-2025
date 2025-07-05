import { IsEnum, IsNotEmpty } from "class-validator";
import { UserStatus } from "../../enums/user-status.enum";

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  @IsNotEmpty()
  status!: UserStatus;
}
