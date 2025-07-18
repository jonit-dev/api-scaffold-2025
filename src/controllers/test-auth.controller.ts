import { JsonController, Get, Post, Body, Param } from "routing-controllers";
import { Service } from "typedi";
import { Authenticated, RequireRole } from "../decorators/auth.decorator";
import { UserRole } from "../models/enums/user-roles.enum";

@JsonController("/test-auth")
@Service()
export class TestAuthController {
  @Get("/public")
  public getPublicEndpoint(): object {
    return {
      message: "This is a public endpoint",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("/protected")
  @Authenticated()
  public getProtectedEndpoint(): object {
    return {
      message: "This is a protected endpoint - you are authenticated!",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("/admin-only")
  @RequireRole(UserRole.Admin)
  public getAdminOnlyEndpoint(): object {
    return {
      message: "This is an admin-only endpoint",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("/moderator-or-admin")
  @RequireRole(UserRole.Moderator, UserRole.Admin)
  public getModeratorOrAdminEndpoint(): object {
    return {
      message: "This endpoint requires moderator or admin role",
      timestamp: new Date().toISOString(),
    };
  }

  @Post("/create-user")
  @RequireRole(UserRole.Admin)
  public createUser(@Body() userData: object): object {
    return {
      message: "User created successfully",
      data: userData,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("/profile/:id")
  @Authenticated()
  public getUserProfile(@Param("id") id: string): object {
    return {
      message: `Fetching profile for user ${id}`,
      userId: id,
      timestamp: new Date().toISOString(),
    };
  }

  @Post("/admin/users")
  @RequireRole(UserRole.Admin)
  public adminCreateUser(@Body() createUserData: object): object {
    return {
      message: "Admin created user",
      data: createUserData,
      adminAction: true,
      timestamp: new Date().toISOString(),
    };
  }
}
