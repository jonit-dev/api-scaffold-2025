import { Request, Response, NextFunction } from "express";
import { Service, Inject } from "typedi";
import { SupabaseClient } from "@supabase/supabase-js";
import { AuthService } from "../services/auth.service";
import { IAuthenticatedUser } from "../types/express";
import { UnauthorizedException } from "../exceptions/http-exceptions";
import { extractBearerToken } from "../utils/auth.utils";

@Service()
export class AuthMiddleware {
  constructor(
    private authService: AuthService,
    @Inject("supabaseAuth") private supabaseClient: SupabaseClient,
  ) {}

  async use(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const token = extractBearerToken(request);

      if (!token) {
        throw new UnauthorizedException("Access token required");
      }

      // Verify user using auth service (handles both SQLite and Supabase)
      const userProfile = await this.authService.verifyUser(token);

      const authenticatedUser: IAuthenticatedUser = {
        id: userProfile.id,
        email: userProfile.email,
        role: userProfile.role,
      };

      request.user = authenticatedUser;
      next();
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        next(error);
        return;
      }
      next(new UnauthorizedException("Authentication failed"));
    }
  }
}
