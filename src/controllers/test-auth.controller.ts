import { JsonController, Get, Post, Body, Param } from "routing-controllers";
import { Service } from "typedi";
import { Authenticated, RequireRole } from "../decorators/auth.decorator";
import { UserRole } from "../models/enums";
import { AuthenticatedUser } from "../types/express";

@JsonController("/api/test-auth")
@Service()
export class TestAuthController {
  @Get("/public")
  public getPublicEndpoint() {
    return {
      message: "This is a public endpoint",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("/protected")
  @Authenticated()
  public getProtectedEndpoint() {
    return {
      message: "This is a protected endpoint - you are authenticated!",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("/admin-only")
  @RequireRole(UserRole.ADMIN)
  public getAdminOnlyEndpoint() {
    return {
      message: "This is an admin-only endpoint",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("/moderator-or-admin")
  @RequireRole(UserRole.MODERATOR, UserRole.ADMIN)
  public getModeratorOrAdminEndpoint() {
    return {
      message: "This endpoint requires moderator or admin role",
      timestamp: new Date().toISOString(),
    };
  }

  @Post("/create-user")
  @RequireRole(UserRole.ADMIN)
  public createUser(@Body() userData: any) {
    return {
      message: "User created successfully",
      data: userData,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("/profile/:id")
  @Authenticated()
  public getUserProfile(@Param("id") id: string) {
    return {
      message: `Fetching profile for user ${id}`,
      userId: id,
      timestamp: new Date().toISOString(),
    };
  }

  @Post("/admin/users")
  @RequireRole(UserRole.ADMIN)
  public adminCreateUser(@Body() createUserData: any) {
    return {
      message: "Admin created user",
      data: createUserData,
      adminAction: true,
      timestamp: new Date().toISOString(),
    };
  }
}
