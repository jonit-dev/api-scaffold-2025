import { Service, Inject } from "typedi";
import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../config/supabase";
import { SQLiteConfig } from "../config/sqlite";
import { config } from "../config/env";
import {
  IDatabase,
  IBaseEntity,
  IPaginationOptions,
  IPaginatedResult,
  IFilterOptions,
  IOrderByOptions,
} from "../types/database.types";
import { SupabaseAdapter, IDatabaseAdapter } from "./adapters/supabase.adapter";
import { SQLiteAdapter } from "./adapters/sqlite.adapter";

@Service()
export abstract class BaseRepository<T extends IBaseEntity> {
  protected abstract tableName: string;
  private adapter: IDatabaseAdapter<T>;
  private supabaseClient?: SupabaseClient<IDatabase>;
  private isTableInitialized = false;

  constructor(@Inject("supabase") supabase?: SupabaseClient<IDatabase>) {
    if (config.database.provider === "sqlite") {
      this.adapter = new SQLiteAdapter<T>(SQLiteConfig.getClient());
      // Note: initializeTable() will be called lazily on first use
    } else {
      this.supabaseClient = supabase || getSupabaseClient();
      this.adapter = new SupabaseAdapter<T>(this.supabaseClient);
    }
  }

  protected ensureTableInitialized(): void {
    if (config.database.provider === "sqlite" && !this.isTableInitialized) {
      if (!this.tableName || this.tableName === "undefined") {
        throw new Error(
          `Invalid table name: ${this.tableName}. Cannot initialize table.`,
        );
      }
      this.initializeTable();
      this.isTableInitialized = true;
    }
  }

  // Backward compatibility for repositories that still use direct Supabase access
  protected get supabase(): SupabaseClient<IDatabase> {
    if (!this.supabaseClient) {
      throw new Error("Supabase client not available in SQLite mode");
    }
    return this.supabaseClient;
  }

  protected abstract initializeTable(): void;

  // Create a new record
  async create(data: Omit<T, "id" | "createdAt" | "updatedAt">): Promise<T> {
    this.ensureTableInitialized();
    return this.adapter.create(data, this.tableName);
  }

  // Find a record by ID
  async findById(id: string): Promise<T | null> {
    this.ensureTableInitialized();
    return this.adapter.findById(id, this.tableName);
  }

  // Find multiple records with optional filters
  async findMany(options?: {
    filters?: IFilterOptions;
    orderBy?: IOrderByOptions;
    pagination?: IPaginationOptions;
  }): Promise<T[]> {
    this.ensureTableInitialized();
    return this.adapter.findMany(options || {}, this.tableName);
  }

  // Find with pagination
  async findWithPagination(options?: {
    filters?: IFilterOptions;
    orderBy?: IOrderByOptions;
    pagination?: IPaginationOptions;
  }): Promise<IPaginatedResult<T>> {
    this.ensureTableInitialized();
    return this.adapter.findWithPagination(options || {}, this.tableName);
  }

  // Update a record
  async update(
    id: string,
    data: Partial<Omit<T, "id" | "createdAt" | "updatedAt">>,
  ): Promise<T> {
    this.ensureTableInitialized();
    return this.adapter.update(id, data, this.tableName);
  }

  // Soft delete a record
  async softDelete(id: string): Promise<void> {
    this.ensureTableInitialized();
    return this.adapter.softDelete(id, this.tableName);
  }

  // Hard delete a record (permanent)
  async hardDelete(id: string): Promise<void> {
    this.ensureTableInitialized();
    return this.adapter.hardDelete(id, this.tableName);
  }

  // Count records
  async count(filters?: IFilterOptions): Promise<number> {
    this.ensureTableInitialized();
    return this.adapter.count(filters, this.tableName);
  }

  // Check if record exists
  async exists(id: string): Promise<boolean> {
    const record = await this.findById(id);
    return record !== null;
  }

  // Find first record matching filters
  async findFirst(filters?: IFilterOptions): Promise<T | null> {
    this.ensureTableInitialized();
    return this.adapter.findFirst(filters, this.tableName);
  }
}
