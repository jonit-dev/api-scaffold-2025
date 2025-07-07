import { UserResponseDto } from "../user/user-response.dto";

export interface ISession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: number;
  expires_in?: number;
  user?: unknown;
}

export class AuthResponseDto {
  user!: UserResponseDto;
  session!: ISession | null;
}

export class SessionResponseDto {
  session!: ISession | null;
}
