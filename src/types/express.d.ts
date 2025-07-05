import { User } from "@supabase/supabase-js";
import { UserRole } from "../models/enums";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  supabaseUser: User;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

export interface TokenPayload {
  sub: string;
  email: string;
  aud: string;
  exp: number;
  iat: number;
  iss: string;
}
