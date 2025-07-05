import { UserResponseDto } from "../user/user-response.dto";
import { Session } from "@supabase/supabase-js";

export class AuthResponseDto {
  user!: UserResponseDto;
  session!: Session | null;
}

export class SessionResponseDto {
  session!: Session | null;
}
