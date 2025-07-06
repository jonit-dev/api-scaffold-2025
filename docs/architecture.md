# API Scaffold - Architecture

## Technology Stack

### Core Dependencies

```bash
# Essential framework packages
npm install express routing-controllers typedi reflect-metadata

# DTO validation and transformation
npm install class-validator class-transformer

# Supabase integration
npm install @supabase/supabase-js
```

### Development Dependencies

```bash
# TypeScript support
npm install -D typescript ts-node @types/express

# Additional middleware
npm install helmet cors express-rate-limit compression morgan dotenv
```

### Essential tsconfig.json

```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@controllers/*": ["controllers/*"],
      "@services/*": ["services/*"],
      "@repositories/*": ["repositories/*"],
      "@models/*": ["models/*"]
    }
  }
}
```

### Server Bootstrap

```typescript
import "reflect-metadata";
import { createExpressServer, useContainer } from "routing-controllers";
import { Container } from "typedi";

// Tell routing-controllers to use TypeDI
useContainer(Container);

const app = createExpressServer({
  controllers: [__dirname + "/controllers/*.js"],
  validation: true,
  classTransformer: true,
});

app.listen(3000);
```

## Folder Structure

### Complete Directory Layout

```
api-scaffold/
├── src/                           # Source code
│   ├── controllers/               # HTTP route controllers
│   │   ├── auth.controller.ts     # Authentication endpoints
│   │   ├── user.controller.ts     # User CRUD operations
│   │   ├── health.controller.ts   # Health check endpoint
│   │   └── index.ts               # Controller exports
│   ├── services/                  # Business logic layer
│   │   ├── auth.service.ts        # Authentication logic
│   │   ├── user.service.ts        # User business logic
│   │   ├── email.service.ts       # Email notifications
│   │   └── index.ts               # Service exports
│   ├── repositories/              # Data access layer
│   │   ├── base.repository.ts     # Base repository class
│   │   ├── user.repository.ts     # User data operations
│   │   ├── auth.repository.ts     # Auth data operations
│   │   └── index.ts               # Repository exports
│   ├── models/                    # Type definitions & DTOs
│   │   ├── entities/              # Database entities
│   │   │   ├── user.entity.ts     # User entity
│   │   │   └── auth.entity.ts     # Auth entity
│   │   ├── dtos/                  # Data transfer objects
│   │   │   ├── auth/              # Auth DTOs
│   │   │   │   ├── login.dto.ts
│   │   │   │   ├── register.dto.ts
│   │   │   │   └── refresh.dto.ts
│   │   │   ├── user/              # User DTOs
│   │   │   │   ├── create-user.dto.ts
│   │   │   │   ├── update-user.dto.ts
│   │   │   │   └── user-response.dto.ts
│   │   │   └── common/            # Common DTOs
│   │   │       ├── pagination.dto.ts
│   │   │       └── response.dto.ts
│   │   ├── enums/                 # Application enums
│   │   │   ├── user-roles.enum.ts
│   │   │   └── auth-providers.enum.ts
│   │   └── interfaces/            # TypeScript interfaces
│   │       ├── auth.interface.ts
│   │       └── user.interface.ts
│   ├── middlewares/               # Custom middleware
│   │   ├── auth.middleware.ts     # Authentication middleware
│   │   ├── error.middleware.ts    # Global error handler
│   │   ├── validation.middleware.ts # Request validation
│   │   ├── rate-limit.middleware.ts # Rate limiting
│   │   ├── cors.middleware.ts     # CORS configuration
│   │   └── index.ts               # Middleware exports
│   ├── config/                    # Configuration files
│   │   ├── app.ts                 # Application config
│   │   ├── database.ts            # Database configuration
│   │   ├── middleware.ts          # Middleware setup
│   │   ├── supabase.ts            # Supabase client
│   │   └── validation.ts          # Validation rules
│   ├── utils/                     # Utility functions
│   │   ├── logger.ts              # Logging utility
│   │   ├── validators.ts          # Custom validators
│   │   ├── crypto.ts              # Encryption utilities
│   │   ├── date.ts                # Date utilities
│   │   └── response.ts            # Response helpers
│   ├── exceptions/                # Custom exceptions
│   │   ├── base.exception.ts      # Base exception class
│   │   ├── validation.exception.ts # Validation errors
│   │   ├── auth.exception.ts      # Auth errors
│   │   └── database.exception.ts  # Database errors
│   ├── types/                     # Global type definitions
│   │   ├── express.d.ts           # Express extensions
│   │   └── global.d.ts            # Global types
│   └── server.ts                  # Application entry point
├── tests/                         # Test files
│   ├── unit/                      # Unit tests
│   ├── integration/               # Integration tests
│   ├── fixtures/                  # Test data
│   └── setup.ts                   # Test setup
├── docs/                          # Documentation
├── scripts/                       # Build scripts
├── .env.example                   # Environment template
├── tsconfig.json                  # TypeScript config
├── package.json                   # Dependencies
└── README.md                      # Project README
```

## Architectural Patterns

### Clean Architecture

The scaffold follows clean architecture principles with clear separation of concerns:

```
┌─────────────────────┐
│    Controllers      │  ← HTTP Layer (routing-controllers)
├─────────────────────┤
│     Services        │  ← Business Logic
├─────────────────────┤
│   Repositories      │  ← Data Access (Repository Pattern)
├─────────────────────┤
│    Database         │  ← Supabase PostgreSQL
└─────────────────────┘
```

### Dependency Injection

Uses **typedi** for dependency injection throughout the application:

```typescript
@Service()
export class UserService {
  constructor(@Inject() private userRepository: UserRepository) {}
}
```

## Layer Responsibilities

### 1. Controllers Layer

- **Purpose**: Handle HTTP requests and responses
- **Framework**: routing-controllers with decorators
- **Responsibilities**:
  - Route definition
  - Request validation
  - Response formatting
  - Error handling

```typescript
@JsonController("/api/users")
export class UserController {
  constructor(private userService: UserService) {}

  @Get("/")
  async getUsers(): Promise<User[]> {
    return this.userService.findAll();
  }
}
```

### 2. Services Layer

- **Purpose**: Business logic and orchestration
- **Responsibilities**:
  - Data validation
  - Business rules
  - Transaction management
  - External API calls

```typescript
@Service()
export class UserService {
  constructor(private userRepository: UserRepository) {}

  async createUser(userData: CreateUserDto): Promise<User> {
    // Business logic here
    return this.userRepository.create(userData);
  }
}
```

### 3. Repository Layer

- **Purpose**: Data access abstraction
- **Pattern**: Repository/Adapter pattern
- **Responsibilities**:
  - Database operations
  - Query construction
  - Data mapping
  - Connection management

```typescript
@Service()
export class UserRepository {
  constructor(private supabase: SupabaseClient) {}

  async create(user: CreateUserDto): Promise<User> {
    const { data, error } = await this.supabase
      .from("users")
      .insert(user)
      .select()
      .single();

    if (error) throw new DatabaseError(error.message);
    return data;
  }
}
```

## Data Flow

### Request Flow

1. **HTTP Request** → Controller
2. **Controller** → Service (business logic)
3. **Service** → Repository (data access)
4. **Repository** → Supabase Database
5. **Response** ← Controller ← Service ← Repository

### Error Handling Flow

1. **Error occurs** at any layer
2. **Custom exceptions** thrown
3. **Global error middleware** catches
4. **Structured response** sent to client

## Database Architecture

### Supabase Integration

- **PostgreSQL** as primary database
- **Row Level Security** for authorization
- **Real-time subscriptions** available
- **Built-in auth** integration

### Repository Pattern Benefits

- **Database agnostic** - easy to switch providers
- **Testable** - mock repositories for unit tests
- **Consistent** - uniform data access patterns
- **Maintainable** - centralized query logic

## Configuration Management

### Environment-based Config

```typescript
export const config = {
  server: {
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || "development",
  },
  database: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
  },
};
```

### Validation Schema

- **class-validator** for DTO validation
- **class-transformer** for data transformation
- **Runtime validation** ensures data integrity

## Security Architecture

### Authentication & Authorization

- **JWT tokens** via Supabase Auth
- **Role-based access control**
- **Middleware protection** for routes

### Data Protection

- **Input sanitization**
- **SQL injection prevention**
- **XSS protection**
- **Rate limiting**

## Middleware Stack

### Core Middleware (in order)

1. **Security headers** (helmet)
2. **CORS** configuration
3. **Rate limiting**
4. **Body parsing**
5. **Authentication**
6. **Validation**
7. **Error handling**

## Testing Strategy

### Unit Tests

- **Service layer** testing
- **Repository mocking**
- **Business logic validation**

### Integration Tests

- **Controller endpoints**
- **Database operations**
- **Full request/response cycle**

## Performance Considerations

### Caching Strategy

The application implements a robust multi-tier caching system with automatic fallback:

#### Cache Architecture

```
┌─────────────────────┐
│   Application       │
├─────────────────────┤
│   CacheService      │  ← Single Public Interface
├─────────────────────┤
│ Memory ←→ Redis     │  ← Multi-tier with fallback
└─────────────────────┘
```

#### Features

- **Single Interface**: CacheService is the only public caching API
- **Automatic Fallback**: Redis unavailable → Memory-only caching
- **Multi-tier Caching**: Memory (L1) + Redis (L2) when available
- **Internal Redis**: Redis operations handled internally by CacheService
- **Health Monitoring**: Cache status reporting and diagnostics
- **Graceful Degradation**: Warnings for Redis-specific features in memory mode

#### Cache Layers

1. **Memory Cache (L1)**:
   - Built-in memory store with LRU
   - Process-local, fastest access
   - Temporary storage, lost on restart

2. **Redis Cache (L2)**:
   - Persistent, distributed storage
   - Survives application restarts
   - Supports advanced Redis features

#### Fallback Behavior

- **Full Support**: get, set, del, exists, incr, decr, cache operations
- **Limited Support**: Hash operations (flattened to simple keys)
- **Redis-only**: List operations, pattern matching, distributed locks

#### Configuration

```typescript
// Automatic Redis detection at startup
// Falls back to memory-only if Redis unavailable
@Service()
export class MyService {
  constructor(private cacheService: CacheService) {}

  async checkHealth() {
    const health = this.cacheService.getHealthStatus();
    // { redis: boolean, memory: boolean }
  }
}
```

### Database Optimization

- **Connection pooling**
- **Query optimization**
- **Index strategy**
- **Query result caching** via CacheService

## Deployment Architecture

### Container Strategy

- **Docker** containerization
- **Multi-stage builds**
- **Environment-specific configs**

### Scaling Considerations

- **Horizontal scaling** ready
- **Database connection limits**
- **Load balancing** support

## Extension Points

### Adding New Features

1. Create **model types**
2. Implement **repository**
3. Build **service layer**
4. Add **controller endpoints**
5. Include **validation**
6. Write **tests**

### Custom Middleware

- Authentication providers
- Logging enhancements
- Performance monitoring
- Custom validators
