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

      // Verify token with Supabase
      const {
        data: { user },
        error,
      } = await this.supabaseClient.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException("Invalid or expired token");
      }

      // Get user profile from our database
      const userProfile = await this.authService.getUserProfile(user.id);

      const authenticatedUser: IAuthenticatedUser = {
        id: user.id,
        email: user.email!,
        role: userProfile.role,
        supabaseUser: user,
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
