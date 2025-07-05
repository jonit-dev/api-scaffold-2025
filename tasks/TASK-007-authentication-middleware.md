# TASK-007: Supabase Authentication Middleware and Route Protection

## Epic

Authentication & Authorization

## Story Points

4

## Priority

High

## Description

Create authentication middleware to protect routes using Supabase Auth, validate JWT tokens through Supabase, and implement role-based access control throughout the application.

## Acceptance Criteria

### ✅ Authentication Middleware

- [ ] Create `src/middlewares/auth.middleware.ts`
- [ ] Implement Supabase JWT token validation
- [ ] Add token extraction from headers
- [ ] Implement user context injection via Supabase
- [ ] Add route protection functionality
- [ ] Handle authentication errors gracefully

### ✅ Role-Based Access Control

- [ ] Create `src/middlewares/rbac.middleware.ts`
- [ ] Implement role validation decorators
- [ ] Add permission checking logic
- [ ] Create role hierarchy system
- [ ] Implement resource-based permissions
- [ ] Add admin-only route protection

### ✅ Authentication Decorators

- [ ] Create `src/decorators/auth.decorator.ts`
- [ ] Implement `@Authenticated()` decorator
- [ ] Create `@RequireRole()` decorator
- [ ] Add `@CurrentUser()` parameter decorator
- [ ] Implement `@RequirePermission()` decorator
- [ ] Add `@OptionalAuth()` decorator

### ✅ Express Type Extensions

- [ ] Create `src/types/express.d.ts`
- [ ] Extend Request interface with user context
- [ ] Add authentication type definitions
- [ ] Include role and permission types
- [ ] Add token payload interface

## Technical Requirements

### Authentication Middleware Structure

```typescript
@Middleware({ type: "before" })
export class AuthMiddleware implements ExpressMiddlewareInterface {
  constructor(
    private authService: AuthService,
    private supabaseClient = supabase
  ) {}

  async use(
    request: Request,
    response: Response,
    next: NextFunction
  ): Promise<void> {
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new AuthException("Access token required", 401);
    }

    try {
      // Verify token with Supabase
      const {
        data: { user },
        error,
      } = await this.supabaseClient.auth.getUser(token);

      if (error || !user) {
        throw new AuthException("Invalid or expired token", 401);
      }

      // Get user profile from our database
      const userProfile = await this.authService.getUserProfile(user.id);

      request.user = {
        id: user.id,
        email: user.email!,
        role: userProfile.role,
        supabaseUser: user,
      };

      next();
    } catch (error) {
      if (error instanceof AuthException) {
        throw error;
      }
      throw new AuthException("Authentication failed", 401);
    }
  }

  private extractTokenFromHeader(request: Request): string | null {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return null;
    }

    const [type, token] = authorization.split(" ");

    if (type !== "Bearer" || !token) {
      return null;
    }

    return token;
  }
}
```

### Role-Based Access Control

```typescript
@Middleware({ type: "before" })
export class RoleMiddleware implements ExpressMiddlewareInterface {
  constructor(private requiredRoles: UserRole[]) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const user = request.user;

    if (!user) {
      throw new AuthException("Authentication required", 401);
    }

    if (!this.hasRequiredRole(user.role, this.requiredRoles)) {
      throw new AuthException("Insufficient permissions", 403);
    }

    next();
  }

  private hasRequiredRole(
    userRole: UserRole,
    requiredRoles: UserRole[]
  ): boolean {
    // Admin has access to everything
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    return requiredRoles.includes(userRole);
  }
}

export function RequireRole(...roles: UserRole[]) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    UseMiddleware(new RoleMiddleware(roles))(target, propertyKey, descriptor);
  };
}
```

### Authentication Decorators

```typescript
export function Authenticated() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    UseMiddleware(AuthMiddleware)(target, propertyKey, descriptor);
  };
}

export function RequireRole(...roles: UserRole[]) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    UseMiddleware(AuthMiddleware, new RoleMiddleware(roles))(
      target,
      propertyKey,
      descriptor
    );
  };
}

export function CurrentUser() {
  return function (target: any, propertyKey: string, parameterIndex: number) {
    const existingMetadata =
      Reflect.getMetadata("custom:currentUser", target, propertyKey) || [];
    existingMetadata.push(parameterIndex);
    Reflect.defineMetadata(
      "custom:currentUser",
      existingMetadata,
      target,
      propertyKey
    );
  };
}

export function OptionalAuth() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const request = args.find(arg => arg && arg.headers);

      if (request) {
        const token = extractTokenFromHeader(request);
        if (token) {
          try {
            const {
              data: { user },
              error,
            } = await supabase.auth.getUser(token);
            if (!error && user) {
              const userProfile = await Container.get(
                AuthService
              ).getUserProfile(user.id);
              request.user = {
                id: user.id,
                email: user.email!,
                role: userProfile.role,
                supabaseUser: user,
              };
            }
          } catch (error) {
            // Ignore invalid token for optional auth
          }
        }
      }

      return originalMethod.apply(this, args);
    };
  };
}
```

### Express Type Extensions

```typescript
import { User } from "@supabase/supabase-js";

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
```

### Controller Usage Examples

```typescript
@JsonController("/api/users")
@Service()
export class UserController {
  constructor(private userService: UserService) {}

  @Get("/")
  @Authenticated()
  async getUsers(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<UserResponseDto[]> {
    return this.userService.findAll();
  }

  @Post("/")
  @RequireRole(UserRole.ADMIN)
  async createUser(
    @Body() createUserDto: CreateUserDto
  ): Promise<UserResponseDto> {
    return this.userService.create(createUserDto);
  }

  @Get("/profile")
  @Authenticated()
  async getProfile(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<UserResponseDto> {
    return this.userService.findById(user.id);
  }

  @Delete("/:id")
  @RequireRole(UserRole.ADMIN)
  async deleteUser(@Param("id") id: string): Promise<void> {
    return this.userService.delete(id);
  }
}
```

## Definition of Done

- [ ] Authentication middleware properly validates Supabase JWT tokens
- [ ] Role-based access control works correctly
- [ ] Authentication decorators function as expected
- [ ] Express Request interface properly extended with Supabase user
- [ ] Token extraction from headers working
- [ ] User context properly injected into controllers
- [ ] Error handling for authentication failures
- [ ] Role hierarchy system implemented
- [ ] Optional authentication decorator functional with Supabase
- [ ] User profile sync between Supabase and local database

## Testing Strategy

- [ ] Test middleware with valid/invalid Supabase tokens
- [ ] Verify role-based access control
- [ ] Test authentication decorators on controllers
- [ ] Check user context injection from Supabase
- [ ] Test error handling for auth failures
- [ ] Verify optional authentication behavior
- [ ] Test Supabase token expiration handling
- [ ] Check role hierarchy logic
- [ ] Test user profile retrieval from local database

## Dependencies

- TASK-006: Authentication Service and JWT Implementation

## Notes

- Ensure middleware order is correct (auth before rbac)
- Supabase handles JWT payload structure
- Implement proper error responses for auth failures
- Token refresh is handled by Supabase client
- Log authentication attempts for security monitoring
- Maintain user profile data sync between Supabase and local DB
- Handle Supabase API errors gracefully
