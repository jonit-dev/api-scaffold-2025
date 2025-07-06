import { SupabaseClient } from "@supabase/supabase-js";
import {
  IDatabase,
  IBaseEntity,
  IPaginationOptions,
  IPaginatedResult,
  IFilterOptions,
  IOrderByOptions,
} from "../../types/database.types";
import {
  DatabaseException,
  handleDatabaseOperation,
} from "../../exceptions/database.exception";
import {
  camelToSnakeKeys,
  snakeToCamelKeys,
} from "../../utils/case-conversion.utils";

export interface IDatabaseAdapter<T extends IBaseEntity> {
  create(
    data: Omit<T, "id" | "createdAt" | "updatedAt">,
    tableName: string,
  ): Promise<T>;
  findById(id: string, tableName: string): Promise<T | null>;
  findMany(
    options: {
      filters?: IFilterOptions;
      orderBy?: IOrderByOptions;
      pagination?: IPaginationOptions;
    },
    tableName: string,
  ): Promise<T[]>;
  findWithPagination(
    options: {
      filters?: IFilterOptions;
      orderBy?: IOrderByOptions;
      pagination?: IPaginationOptions;
    },
    tableName: string,
  ): Promise<IPaginatedResult<T>>;
  update(
    id: string,
    data: Partial<Omit<T, "id" | "createdAt" | "updatedAt">>,
    tableName: string,
  ): Promise<T>;
  softDelete(id: string, tableName: string): Promise<void>;
  hardDelete(id: string, tableName: string): Promise<void>;
  count(
    filters: IFilterOptions | undefined,
    tableName: string,
  ): Promise<number>;
  findFirst(
    filters: IFilterOptions | undefined,
    tableName: string,
  ): Promise<T | null>;
}

export class SupabaseAdapter<T extends IBaseEntity>
  implements IDatabaseAdapter<T>
{
  constructor(private supabase: SupabaseClient<IDatabase>) {}

  async create(
    data: Omit<T, "id" | "createdAt" | "updatedAt">,
    tableName: string,
  ): Promise<T> {
    return handleDatabaseOperation(async () => {
      const snakeData = camelToSnakeKeys({
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const { data: result, error } = await this.supabase
        .from(tableName)
        .insert(snakeData)
        .select()
        .single();

      if (error) {
        throw new DatabaseException(error.message);
      }

      if (!result) {
        throw new DatabaseException("Failed to create entity");
      }

      return { data: snakeToCamelKeys<T>(result), error };
    });
  }

  async findById(id: string, tableName: string): Promise<T | null> {
    return handleDatabaseOperation(async () => {
      const { data, error } = await this.supabase
        .from(tableName)
        .select()
        .eq("id", id)
        .eq("deleted_at", null)
        .single();

      // Handle "not found" as null, not an error
      if (error && error.code === "PGRST116") {
        return { data: null, error: null };
      }

      return { data: data ? snakeToCamelKeys<T>(data) : null, error };
    });
  }

  async findMany(
    options: {
      filters?: IFilterOptions;
      orderBy?: IOrderByOptions;
      pagination?: IPaginationOptions;
    },
    tableName: string,
  ): Promise<T[]> {
    return handleDatabaseOperation(async () => {
      let query = this.supabase.from(tableName).select().eq("deleted_at", null);

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
      return {
        data: (data || []).map((item) => snakeToCamelKeys<T>(item)),
        error,
      };
    });
  }

  async findWithPagination(
    options: {
      filters?: IFilterOptions;
      orderBy?: IOrderByOptions;
      pagination?: IPaginationOptions;
    },
    tableName: string,
  ): Promise<IPaginatedResult<T>> {
    const { page = 1, limit = 10 } = options?.pagination || {};
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from(tableName)
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
      data: (data || []).map((item) => snakeToCamelKeys<T>(item)),
      pagination: {
        page,
        limit,
        total,
        hasNext: offset + limit < total,
        hasPrevious: page > 1,
      },
    };
  }

  async update(
    id: string,
    data: Partial<Omit<T, "id" | "createdAt" | "updatedAt">>,
    tableName: string,
  ): Promise<T> {
    return handleDatabaseOperation(async () => {
      const snakeData = camelToSnakeKeys({
        ...data,
        updated_at: new Date().toISOString(),
      });

      const { data: result, error } = await this.supabase
        .from(tableName)
        .update(snakeData)
        .eq("id", id)
        .eq("deleted_at", null)
        .select()
        .single();

      if (error) {
        throw new DatabaseException(error.message);
      }

      if (!result) {
        throw new DatabaseException("Failed to update entity");
      }

      return { data: snakeToCamelKeys<T>(result), error };
    });
  }

  async softDelete(id: string, tableName: string): Promise<void> {
    return handleDatabaseOperation(async () => {
      const { error } = await this.supabase
        .from(tableName)
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("deleted_at", null);

      return { data: undefined, error };
    });
  }

  async hardDelete(id: string, tableName: string): Promise<void> {
    return handleDatabaseOperation(async () => {
      const { error } = await this.supabase
        .from(tableName)
        .delete()
        .eq("id", id);

      return { data: undefined, error };
    });
  }

  async count(
    filters: IFilterOptions | undefined,
    tableName: string,
  ): Promise<number> {
    return handleDatabaseOperation(async () => {
      let query = this.supabase
        .from(tableName)
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

  async findFirst(
    filters: IFilterOptions | undefined,
    tableName: string,
  ): Promise<T | null> {
    return handleDatabaseOperation(async () => {
      let query = this.supabase
        .from(tableName)
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

      return {
        data: data && data.length > 0 ? snakeToCamelKeys<T>(data[0]) : null,
        error: null,
      };
    });
  }
}
