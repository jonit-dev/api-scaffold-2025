import { User } from "@supabase/supabase-js";
import { Request } from "express";
import { UserRole } from "../models/enums/user-roles.enum";

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    interface Request {
      user?: IAuthenticatedUser;
    }
  }
}

export interface IAuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  supabaseUser: User;
}

export interface IAuthenticatedRequest extends Request {
  user: IAuthenticatedUser;
}

export interface ITokenPayload {
  sub: string;
  email: string;
  aud: string;
  exp: number;
  iat: number;
  iss: string;
}
