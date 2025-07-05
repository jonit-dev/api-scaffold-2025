# Database Guide

This guide explains how to work with the Supabase PostgreSQL database using our repository pattern and TypeDI dependency injection.

## Getting Started

### Accessing the Database

The database is accessible through repositories that extend `BaseRepository`:

```typescript
import { Container } from "typedi";
import { UserRepository } from "@repositories/user.repository";

// In a service
@Service()
export class UserService {
  private userRepository = Container.get(UserRepository);

  // Use this.userRepository in your methods
}

// Or directly
const userRepository = Container.get(UserRepository);
```

### Direct Supabase Client Access

For complex queries not covered by repositories:

```typescript
import { Container } from "typedi";
import { SupabaseClient } from "@supabase/supabase-js";

@Service()
export class MyService {
  private supabase = Container.get<SupabaseClient>("supabase");

  async customQuery() {
    const { data, error } = await this.supabase
      .from("users")
      .select("*")
      .eq("status", "active");
  }
}
```

## Repository Pattern

### Using Base Repository

All repositories extend `BaseRepository` which provides standard CRUD operations:

```typescript
@Service()
export class ProductRepository extends BaseRepository<IProductEntity> {
  protected tableName = "products";

  // Custom methods specific to products
  async findByCategory(category: string): Promise<IProductEntity[]> {
    return this.findMany({
      filters: { category },
      orderBy: { column: "created_at", ascending: false },
    });
  }
}
```

### Creating Records

```typescript
// Create a new user
const userData = {
  email: "john@example.com",
  first_name: "John",
  last_name: "Doe",
  role: UserRole.USER,
  status: UserStatus.ACTIVE,
};

const user = await userRepository.create(userData);
console.log(user.id); // Auto-generated ID
console.log(user.created_at); // Auto-set timestamp
```

### Reading Records

```typescript
// Find by ID
const user = await userRepository.findById("user-123");
if (!user) {
  throw new NotFoundException("User not found");
}

// Find by email (custom method)
const user = await userRepository.findByEmail("john@example.com");

// Find multiple with filters
const activeUsers = await userRepository.findMany({
  filters: { status: UserStatus.ACTIVE },
  orderBy: { column: "created_at", ascending: false },
  pagination: { page: 1, limit: 10 },
});

// Find first matching record
const admin = await userRepository.findFirst({
  role: UserRole.ADMIN,
  status: UserStatus.ACTIVE,
});
```

### Updating Records

```typescript
// Update user
const updatedUser = await userRepository.update("user-123", {
  first_name: "Jane",
  last_name: "Smith",
});

// The updated_at timestamp is automatically set
console.log(updatedUser.updated_at);
```

### Deleting Records

```typescript
// Soft delete (recommended - sets deleted_at timestamp)
await userRepository.softDelete("user-123");

// Hard delete (permanent removal)
await userRepository.hardDelete("user-123");
```

## Pagination

### Basic Pagination

```typescript
const result = await userRepository.findWithPagination({
  pagination: { page: 1, limit: 20 },
  orderBy: { column: "created_at", ascending: false },
});

console.log(result.data); // Array of users
console.log(result.pagination.total); // Total count
console.log(result.pagination.hasNext); // Boolean
console.log(result.pagination.hasPrevious); // Boolean
```

### Advanced Filtering with Pagination

```typescript
// In UserRepository
async findUsersPaginated(
  page: number = 1,
  limit: number = 10,
  filters?: IUserFilters
): Promise<IPaginatedResult<IUserEntity>> {
  const offset = (page - 1) * limit;
  let query = this.supabase
    .from(this.tableName)
    .select("*", { count: "exact" })
    .eq("deleted_at", null);

  // Apply filters
  if (filters?.role) {
    query = query.eq("role", filters.role);
  }
  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.search) {
    query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  }

  // Apply pagination and ordering
  query = query
    .range(offset, offset + limit - 1)
    .order("created_at", { ascending: false });

  const { data, error, count } = await query;

  if (error) {
    throw new DatabaseException(error.message);
  }

  return {
    data: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      hasNext: offset + limit < (count || 0),
      hasPrevious: page > 1,
    },
  };
}
```

## Complex Queries

### Joins and Relations

```typescript
@Service()
export class OrderService {
  private supabase = Container.get<SupabaseClient>("supabase");

  async getOrdersWithItems(userId: string) {
    const { data, error } = await this.supabase
      .from("orders")
      .select(
        `
        *,
        order_items (
          *,
          products (
            name,
            price
          )
        ),
        users (
          first_name,
          last_name,
          email
        )
      `,
      )
      .eq("user_id", userId)
      .eq("deleted_at", null);

    if (error) {
      throw new DatabaseException(error.message);
    }

    return data;
  }
}
```

### Aggregations

```typescript
async getUserStats() {
  const { data, error } = await this.supabase
    .from("users")
    .select("role")
    .eq("deleted_at", null);

  if (error) {
    throw new DatabaseException(error.message);
  }

  // Count by role
  const stats = data.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {});

  return stats;
}

async getMonthlySignups() {
  const { data, error } = await this.supabase
    .rpc("get_monthly_signups"); // Custom database function

  if (error) {
    throw new DatabaseException(error.message);
  }

  return data;
}
```

### Search and Filtering

```typescript
async searchUsers(searchTerm: string, filters: any = {}) {
  let query = this.supabase
    .from("users")
    .select("*")
    .eq("deleted_at", null);

  // Text search across multiple columns
  if (searchTerm) {
    query = query.or(
      `first_name.ilike.%${searchTerm}%,` +
      `last_name.ilike.%${searchTerm}%,` +
      `email.ilike.%${searchTerm}%`
    );
  }

  // Additional filters
  if (filters.role) {
    query = query.eq("role", filters.role);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte("created_at", filters.dateTo);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new DatabaseException(error.message);
  }

  return data;
}
```

## Transactions

For operations that need to be atomic:

```typescript
@Service()
export class TransferService {
  private supabase = Container.get<SupabaseClient>("supabase");

  async transferFunds(fromUserId: string, toUserId: string, amount: number) {
    const { data, error } = await this.supabase.rpc("transfer_funds", {
      from_user_id: fromUserId,
      to_user_id: toUserId,
      transfer_amount: amount,
    });

    if (error) {
      throw new DatabaseException(`Transfer failed: ${error.message}`);
    }

    return data;
  }
}
```

### Manual Transaction Pattern

```typescript
async complexUserOperation(userData: any) {
  try {
    // Start transaction-like operations
    const user = await this.userRepository.create(userData);

    try {
      await this.profileRepository.create({
        user_id: user.id,
        bio: userData.bio
      });

      await this.notificationService.sendWelcomeEmail(user.email);

      return user;
    } catch (error) {
      // Rollback user creation
      await this.userRepository.hardDelete(user.id);
      throw error;
    }
  } catch (error) {
    throw new DatabaseException(`User creation failed: ${error.message}`);
  }
}
```

## Real-time Subscriptions

For real-time updates using Supabase's built-in capabilities:

```typescript
@Service()
export class RealtimeService {
  private supabase = Container.get<SupabaseClient>("supabase");

  subscribeToUserChanges(userId: string, callback: (payload: any) => void) {
    return this.supabase
      .channel("user-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "users",
          filter: `id=eq.${userId}`,
        },
        callback,
      )
      .subscribe();
  }

  subscribeToNewOrders(callback: (payload: any) => void) {
    return this.supabase
      .channel("new-orders")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        callback,
      )
      .subscribe();
  }
}
```

## Custom Repository Methods

### Creating Specialized Queries

```typescript
@Service()
export class UserRepository extends BaseRepository<IUserEntity> {
  protected tableName = "users";

  async findByRole(role: UserRole): Promise<IUserEntity[]> {
    return this.findMany({
      filters: { role },
      orderBy: { column: "created_at", ascending: false },
    });
  }

  async countByStatus(): Promise<Record<UserStatus, number>> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("status")
      .eq("deleted_at", null);

    if (error) {
      throw new DatabaseException(error.message);
    }

    return data.reduce(
      (acc, user) => {
        acc[user.status] = (acc[user.status] || 0) + 1;
        return acc;
      },
      {} as Record<UserStatus, number>,
    );
  }

  async findUnverifiedUsers(daysOld: number = 7): Promise<IUserEntity[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("deleted_at", null)
      .eq("email_verified", false)
      .lt("created_at", cutoffDate.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      throw new DatabaseException(error.message);
    }

    return data || [];
  }

  async updateLastLogin(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .update({
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .eq("deleted_at", null);

    if (error) {
      throw new DatabaseException(error.message);
    }
  }

  async isEmailUnique(email: string, excludeId?: string): Promise<boolean> {
    let query = this.supabase
      .from(this.tableName)
      .select("id")
      .eq("email", email)
      .eq("deleted_at", null);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data, error } = await query.single();

    if (error && error.code === "PGRST116") {
      return true; // No user found, email is unique
    }

    if (error) {
      throw new DatabaseException(error.message);
    }

    return !data; // Email is unique if no data returned
  }
}
```

## Error Handling

### Using Database Exception Handler

The `handleDatabaseOperation` utility provides consistent error handling:

```typescript
import { handleDatabaseOperation } from "@exceptions/database.exception";

async customQuery() {
  return handleDatabaseOperation(async () => {
    const { data, error } = await this.supabase
      .from("users")
      .select("*")
      .eq("status", "active");

    return { data: data || [], error };
  });
}
```

### Manual Error Handling

```typescript
async findUserByEmail(email: string): Promise<IUserEntity | null> {
  try {
    const { data, error } = await this.supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .eq("deleted_at", null)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new DatabaseException(`Failed to find user: ${error.message}`);
    }

    return data;
  } catch (error) {
    if (error instanceof DatabaseException) {
      throw error;
    }
    throw new DatabaseException(`Unexpected error: ${error.message}`);
  }
}
```

## Best Practices

### 1. Always Handle Soft Deletes

```typescript
// Good - filters out deleted records
const { data } = await this.supabase
  .from("users")
  .select("*")
  .eq("deleted_at", null);

// Bad - includes deleted records
const { data } = await this.supabase.from("users").select("*");
```

### 2. Use Proper Typing

```typescript
// Define interfaces for your entities
interface IUserEntity {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Use typed queries
const users = await this.supabase
  .from("users")
  .select("*")
  .returns<IUserEntity[]>();
```

### 3. Optimize Queries

```typescript
// Good - select only needed columns
const { data } = await this.supabase
  .from("users")
  .select("id, email, first_name, last_name")
  .eq("status", "active");

// Good - use proper indexes and filters
const { data } = await this.supabase
  .from("orders")
  .select("*")
  .eq("user_id", userId)
  .gte("created_at", startDate)
  .order("created_at", { ascending: false })
  .limit(20);
```

### 4. Validate Input

```typescript
async createUser(userData: CreateUserDto): Promise<IUserEntity> {
  // Validate email uniqueness
  const isUnique = await this.isEmailUnique(userData.email);
  if (!isUnique) {
    throw new ConflictException("Email already exists");
  }

  // Validate data before inserting
  if (!userData.email || !userData.first_name) {
    throw new BadRequestException("Missing required fields");
  }

  return this.create(userData);
}
```

## Environment Configuration

Database configuration is in `src/config/supabase.ts`. Environment variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Testing

In tests, the database is automatically mocked. You can mock specific responses:

```typescript
describe("UserService", () => {
  it("should create user", async () => {
    const userService = Container.get(UserService);

    // The database calls are automatically mocked
    const user = await userService.createUser({
      email: "test@example.com",
      first_name: "Test",
      last_name: "User",
    });

    expect(user).toBeDefined();
  });
});
```

For specific mock responses:

```typescript
import { getSupabaseMockInstance } from "@tests/setup/supabase.mock";

describe("UserService", () => {
  it("should handle user not found", async () => {
    const mockSupabase = getSupabaseMockInstance();

    // Mock specific response
    mockSupabase
      .from()
      .select()
      .eq()
      .single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116", message: "Not found" },
      });

    const userService = Container.get(UserService);
    const user = await userService.findById("non-existent");

    expect(user).toBeNull();
  });
});
```

## Migration and Schema

Database schema changes should be handled through Supabase migrations. Always:

1. Create migrations for schema changes
2. Update TypeScript interfaces to match
3. Test migrations in development first
4. Use proper foreign key constraints
5. Add indexes for frequently queried columns

```sql
-- Example migration
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category_id UUID REFERENCES categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- Add indexes
CREATE INDEX idx_products_category ON products(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_price ON products(price) WHERE deleted_at IS NULL;
```
