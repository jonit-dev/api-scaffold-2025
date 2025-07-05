# TASK-003: Supabase Integration and Database Configuration

## Epic

Database Setup

## Story Points

5

## Priority

High

## Description

Set up Supabase client integration, create database configuration, and implement the base repository pattern for data access abstraction.

## Acceptance Criteria

### ✅ Supabase Client Setup

- [ ] Create `src/config/supabase.ts` for client configuration
- [ ] Set up Supabase client with environment variables
- [ ] Configure connection options (auth, realtime, etc.)
- [ ] Implement client singleton pattern
- [ ] Add connection health check

### ✅ Database Configuration

- [ ] Create `src/config/database.ts` for database config
- [ ] Set up environment variable validation for database
- [ ] Configure database connection pooling if needed
- [ ] Implement database connection testing
- [ ] Add database migration support structure

### ✅ Base Repository Pattern

- [ ] Create `src/repositories/base.repository.ts`
- [ ] Implement generic CRUD operations
- [ ] Add error handling for database operations
- [ ] Create consistent response patterns
- [ ] Implement query builder helpers
- [ ] Add transaction support structure

### ✅ Database Models

- [ ] Create `src/models/entities/` directory
- [ ] Define base entity interface
- [ ] Create common database field types
- [ ] Implement entity validation
- [ ] Add timestamps and audit fields

### ✅ Database Exceptions

- [ ] Create `src/exceptions/database.exception.ts`
- [ ] Implement specific database error types
- [ ] Add Supabase error code mapping
- [ ] Create user-friendly error messages
- [ ] Add error logging for database operations

## Technical Requirements

### Supabase Client Configuration

```typescript
import { createClient } from "@supabase/supabase-js";
import { config } from "./app";
import { Database } from "../types/database.types";

// Create typed Supabase client for enhanced type safety
export const supabase = createClient<Database>(
  config.database.url,
  config.database.anonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // For server-side usage
    },
    realtime: {
      enabled: true,
    },
    global: {
      headers: {
        "X-Client-Info": "api-scaffold",
      },
    },
  }
);

// Singleton pattern for consistent client usage
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = supabase;
  }
  return supabaseInstance;
}

// Health check function
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("health_check")
      .select("count")
      .single();
    return !error;
  } catch (error) {
    console.error("Supabase connection check failed:", error);
    return false;
  }
}
```

### Installation and Setup

```bash
# Install Supabase JavaScript client
npm install @supabase/supabase-js

# For server-side rendering (if needed later)
npm install @supabase/ssr
```

### Base Repository Structure

```typescript
import { Service } from "typedi";
import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../config/supabase";
import { DatabaseException } from "../exceptions/database.exception";

@Service()
export abstract class BaseRepository<T> {
  protected supabase: SupabaseClient;
  protected tableName: string;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  async create(data: Partial<T>): Promise<T> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .insert(data)
      .select()
      .single();

    if (error) throw new DatabaseException(error.message);
    return result;
  }

  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select()
      .eq("id", id)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new DatabaseException(error.message);
    }
    return data;
  }

  async findMany(filters?: Record<string, any>): Promise<T[]> {
    let query = this.supabase.from(this.tableName).select();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }

    const { data, error } = await query;
    if (error) throw new DatabaseException(error.message);
    return data || [];
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new DatabaseException(error.message);
    return result;
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .update({ deleted_at: new Date() })
      .eq("id", id);

    if (error) throw new DatabaseException(error.message);
  }

  async hardDelete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq("id", id);

    if (error) throw new DatabaseException(error.message);
  }
}
```

### TypeDI Integration Notes

- All repositories must be decorated with `@Service()` for TypeDI container management
- Use the singleton Supabase client via `getSupabaseClient()` function
- TypeDI will automatically inject repositories into services that depend on them

### Environment Variables

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/database
DB_POOL_SIZE=20
DB_CONNECTION_TIMEOUT=30000
```

## Definition of Done

- [ ] Supabase client connects successfully
- [ ] Base repository pattern implemented and tested
- [ ] Database operations work with proper error handling
- [ ] Environment variables properly configured
- [ ] Connection health check functional
- [ ] Database exceptions properly categorized
- [ ] All database operations logged appropriately

## Testing Strategy

- [ ] Test Supabase client connection
- [ ] Verify base repository CRUD operations
- [ ] Test database error handling
- [ ] Verify environment variable loading
- [ ] Test connection pooling if implemented
- [ ] Check database exception mapping

## Dependencies

- TASK-002: Core Server Configuration and Middleware Setup

## Notes

- Ensure sensitive credentials are never logged
- Test database connection before server start
- Keep repository methods consistent across implementations
- Consider implementing connection retry logic
