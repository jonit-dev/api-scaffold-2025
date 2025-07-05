# TASK-007: Authentication Middleware and Route Protection

## Epic
Authentication & Authorization

## Story Points
5

## Priority
High

## Description
Create authentication middleware to protect routes, validate JWT tokens, and implement role-based access control throughout the application.

## Acceptance Criteria

### ✅ Authentication Middleware
- [ ] Create `src/middlewares/auth.middleware.ts`
- [ ] Implement JWT token validation
- [ ] Add token extraction from headers
- [ ] Implement user context injection
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
@Middleware({ type: 'before' })
export class AuthMiddleware implements ExpressMiddlewareInterface {
  constructor(private authService: AuthService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new AuthException('Access token required', 401);
    }

    try {
      const payload = this.verifyToken(token);
      request.user = payload;
      next();
    } catch (error) {
      throw new AuthException('Invalid or expired token', 401);
    }
  }

  private extractTokenFromHeader(request: Request): string | null {
    const authorization = request.headers.authorization;
    
    if (!authorization) {
      return null;
    }

    const [type, token] = authorization.split(' ');
    
    if (type !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }

  private verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as JwtPayload;
    } catch (error) {
      throw new AuthException('Invalid token', 401);
    }
  }
}
```

### Role-Based Access Control
```typescript
@Middleware({ type: 'before' })
export class RoleMiddleware implements ExpressMiddlewareInterface {
  constructor(private requiredRoles: UserRole[]) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const user = request.user;
    
    if (!user) {
      throw new AuthException('Authentication required', 401);
    }

    if (!this.hasRequiredRole(user.role, this.requiredRoles)) {
      throw new AuthException('Insufficient permissions', 403);
    }

    next();
  }

  private hasRequiredRole(userRole: UserRole, requiredRoles: UserRole[]): boolean {
    // Admin has access to everything
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    return requiredRoles.includes(userRole);
  }
}

export function RequireRole(...roles: UserRole[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    UseMiddleware(new RoleMiddleware(roles))(target, propertyKey, descriptor);
  };
}
```

### Authentication Decorators
```typescript
export function Authenticated() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    UseMiddleware(AuthMiddleware)(target, propertyKey, descriptor);
  };
}

export function RequireRole(...roles: UserRole[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    UseMiddleware(AuthMiddleware, new RoleMiddleware(roles))(target, propertyKey, descriptor);
  };
}

export function CurrentUser() {
  return function (target: any, propertyKey: string, parameterIndex: number) {
    const existingMetadata = Reflect.getMetadata('custom:currentUser', target, propertyKey) || [];
    existingMetadata.push(parameterIndex);
    Reflect.defineMetadata('custom:currentUser', existingMetadata, target, propertyKey);
  };
}

export function OptionalAuth() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const request = args.find(arg => arg && arg.headers);
      
      if (request) {
        const token = extractTokenFromHeader(request);
        if (token) {
          try {
            request.user = jwt.verify(token, config.jwt.secret);
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
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
```

### Controller Usage Examples
```typescript
@JsonController('/api/users')
@Service()
export class UserController {
  constructor(private userService: UserService) {}

  @Get('/')
  @Authenticated()
  async getUsers(@CurrentUser() user: JwtPayload): Promise<UserResponseDto[]> {
    return this.userService.findAll();
  }

  @Post('/')
  @RequireRole(UserRole.ADMIN)
  async createUser(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.userService.create(createUserDto);
  }

  @Get('/profile')
  @Authenticated()
  async getProfile(@CurrentUser() user: JwtPayload): Promise<UserResponseDto> {
    return this.userService.findById(user.userId);
  }

  @Delete('/:id')
  @RequireRole(UserRole.ADMIN)
  async deleteUser(@Param('id') id: string): Promise<void> {
    return this.userService.delete(id);
  }
}
```

## Definition of Done
- [ ] Authentication middleware properly validates JWT tokens
- [ ] Role-based access control works correctly
- [ ] Authentication decorators function as expected
- [ ] Express Request interface properly extended
- [ ] Token extraction from headers working
- [ ] User context properly injected into controllers
- [ ] Error handling for authentication failures
- [ ] Role hierarchy system implemented
- [ ] Optional authentication decorator functional

## Testing Strategy
- [ ] Test middleware with valid/invalid tokens
- [ ] Verify role-based access control
- [ ] Test authentication decorators on controllers
- [ ] Check user context injection
- [ ] Test error handling for auth failures
- [ ] Verify optional authentication behavior
- [ ] Test token expiration handling
- [ ] Check role hierarchy logic

## Dependencies
- TASK-006: Authentication Service and JWT Implementation

## Notes
- Ensure middleware order is correct (auth before rbac)
- Keep JWT payload minimal but sufficient
- Implement proper error responses for auth failures
- Consider implementing token refresh in middleware
- Log authentication attempts for security monitoring