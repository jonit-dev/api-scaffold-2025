import { Service, Inject } from "typedi";
import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../config/supabase";
import {
  IDatabase,
  IBaseEntity,
  IPaginationOptions,
  IPaginatedResult,
  IFilterOptions,
  IOrderByOptions,
} from "../types/database.types";
import {
  DatabaseException,
  handleDatabaseOperation,
} from "../exceptions/database.exception";

@Service()
export abstract class BaseRepository<T extends IBaseEntity> {
  protected supabase: SupabaseClient<IDatabase>;
  protected abstract tableName: string;

  constructor(@Inject("supabase") supabase?: SupabaseClient<IDatabase>) {
    this.supabase = supabase || getSupabaseClient();
  }

  // Create a new record
  async create(data: Omit<T, "id" | "created_at" | "updated_at">): Promise<T> {
    return handleDatabaseOperation(async () => {
      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .insert({
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      return { data: result, error };
    });
  }

  // Find a record by ID
  async findById(id: string): Promise<T | null> {
    return handleDatabaseOperation(async () => {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select()
        .eq("id", id)
        .eq("deleted_at", null)
        .single();

      // Handle "not found" as null, not an error
      if (error && error.code === "PGRST116") {
        return { data: null, error: null };
      }

      return { data, error };
    });
  }

  // Find multiple records with optional filters
  async findMany(options?: {
    filters?: IFilterOptions;
    orderBy?: IOrderByOptions;
    pagination?: IPaginationOptions;
  }): Promise<T[]> {
    return handleDatabaseOperation(async () => {
      let query = this.supabase
        .from(this.tableName)
        .select()
        .eq("deleted_at", null);

      // Apply filters
      if (options?.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        });
      }

      // Apply ordering
      if (options?.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending ?? true,
        });
      }

      // Apply pagination
      if (options?.pagination) {
        const { page = 1, limit = 10 } = options.pagination;
        const offset = (page - 1) * limit;
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;
      return { data: data || [], error };
    });
  }

  // Find with pagination
  async findWithPagination(options?: {
    filters?: IFilterOptions;
    orderBy?: IOrderByOptions;
    pagination?: IPaginationOptions;
  }): Promise<IPaginatedResult<T>> {
    const { page = 1, limit = 10 } = options?.pagination || {};
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from(this.tableName)
      .select("*", { count: "exact" })
      .eq("deleted_at", null);

    // Apply filters
    if (options?.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    // Apply ordering
    if (options?.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending ?? true,
      });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new DatabaseException(error.message);
    }

    const total = count || 0;
    return {
      data: data || [],
      pagination: {
        page,
        limit,
        total,
        hasNext: offset + limit < total,
        hasPrevious: page > 1,
      },
    };
  }

  // Update a record
  async update(
    id: string,
    data: Partial<Omit<T, "id" | "created_at" | "updated_at">>,
  ): Promise<T> {
    return handleDatabaseOperation(async () => {
      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("deleted_at", null)
        .select()
        .single();

      return { data: result, error };
    });
  }

  // Soft delete a record
  async softDelete(id: string): Promise<void> {
    return handleDatabaseOperation(async () => {
      const { error } = await this.supabase
        .from(this.tableName)
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("deleted_at", null);

      return { data: undefined, error };
    });
  }

  // Hard delete a record (permanent)
  async hardDelete(id: string): Promise<void> {
    return handleDatabaseOperation(async () => {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq("id", id);

      return { data: undefined, error };
    });
  }

  // Count records
  async count(filters?: IFilterOptions): Promise<number> {
    return handleDatabaseOperation(async () => {
      let query = this.supabase
        .from(this.tableName)
        .select("*", { count: "exact", head: true })
        .eq("deleted_at", null);

      // Apply filters
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        });
      }

      const { count, error } = await query;
      return { data: count || 0, error };
    });
  }

  // Check if record exists
  async exists(id: string): Promise<boolean> {
    const record = await this.findById(id);
    return record !== null;
  }

  // Find first record matching filters
  async findFirst(filters?: IFilterOptions): Promise<T | null> {
    return handleDatabaseOperation(async () => {
      let query = this.supabase
        .from(this.tableName)
        .select()
        .eq("deleted_at", null)
        .limit(1);

      // Apply filters
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        });
      }

      const { data, error } = await query;

      if (error) {
        return { data: null, error };
      }

      return { data: data && data.length > 0 ? data[0] : null, error: null };
    });
  }
}
