import { Service } from "typedi";
import { BaseRepository } from "./base.repository";
import { IUserEntity } from "../models/entities/user.entity";
import { IUserFilters } from "../models/interfaces/user.interface";
import { UserRole } from "../models/enums/user-roles.enum";
import { UserStatus } from "../models/enums/user-status.enum";
import { DatabaseException } from "../exceptions/database.exception";
import { IPaginatedResult } from "../types/database.types";
import { config } from "../config/env";
import { SQLiteConfig } from "../config/sqlite";
import { getSupabaseClient } from "../config/supabase";
import { snakeToCamelKeys } from "../utils/case-conversion.utils";

@Service()
export class UserRepository extends BaseRepository<IUserEntity> {
  protected tableName = "users";

  protected initializeTable(): void {
    if (config.database.provider !== "sqlite") return;
    if (!this.tableName || this.tableName === "undefined") {
      throw new Error(
        `Invalid table name: ${this.tableName}. Cannot initialize table.`,
      );
    }

    const db = SQLiteConfig.getClient();
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        first_name TEXT,
        last_name TEXT,
        password_hash TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        status TEXT NOT NULL DEFAULT 'active',
        email_verified BOOLEAN DEFAULT FALSE,
        phone TEXT,
        avatar_url TEXT,
        last_login TEXT,
        stripe_customer_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )
    `;

    db.prepare(createTableQuery).run();

    // Create indexes for performance
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_users_email ON ${this.tableName}(email)`,
      `CREATE INDEX IF NOT EXISTS idx_users_role ON ${this.tableName}(role)`,
      `CREATE INDEX IF NOT EXISTS idx_users_status ON ${this.tableName}(status)`,
      `CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON ${this.tableName}(stripe_customer_id)`,
      `CREATE INDEX IF NOT EXISTS idx_users_created_at ON ${this.tableName}(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON ${this.tableName}(deleted_at)`,
    ];

    indexes.forEach((indexQuery) => {
      db.prepare(indexQuery).run();
    });
  }

  async findByEmail(email: string): Promise<IUserEntity | null> {
    if (config.database.provider === "sqlite") {
      this.ensureTableInitialized();
      return this.findByEmailSQLite(email);
    } else {
      return this.findByEmailSupabase(email);
    }
  }

  private async findByEmailSQLite(email: string): Promise<IUserEntity | null> {
    const db = SQLiteConfig.getClient();
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE email = ? AND deleted_at IS NULL
    `;

    const result = db.prepare(query).get(email) as Record<string, unknown>;
    return result ? snakeToCamelKeys<IUserEntity>(result) : null;
  }

  private async findByEmailSupabase(
    email: string,
  ): Promise<IUserEntity | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("email", email)
      .eq("deleted_at", null)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new DatabaseException(error.message);
    }

    return data ? snakeToCamelKeys<IUserEntity>(data) : null;
  }

  async findUsersPaginated(
    page: number = 1,
    limit: number = 10,
    filters?: IUserFilters,
  ): Promise<IPaginatedResult<IUserEntity>> {
    if (config.database.provider === "sqlite") {
      this.ensureTableInitialized();
      return this.findUsersPaginatedSQLite(page, limit, filters);
    } else {
      return this.findUsersPaginatedSupabase(page, limit, filters);
    }
  }

  private async findUsersPaginatedSQLite(
    page: number = 1,
    limit: number = 10,
    filters?: IUserFilters,
  ): Promise<IPaginatedResult<IUserEntity>> {
    const db = SQLiteConfig.getClient();
    const offset = (page - 1) * limit;
    let whereConditions = ["deleted_at IS NULL"];
    let params: unknown[] = [];

    // Apply filters
    if (filters?.role) {
      whereConditions.push("role = ?");
      params.push(filters.role);
    }
    if (filters?.status) {
      whereConditions.push("status = ?");
      params.push(filters.status);
    }
    if (filters?.emailVerified !== undefined) {
      whereConditions.push("email_verified = ?");
      params.push(filters.emailVerified ? 1 : 0);
    }
    if (filters?.search) {
      whereConditions.push(
        "(first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)",
      );
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.join(" AND ");

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} WHERE ${whereClause}`;
    const countResult = db.prepare(countQuery).get(params) as {
      total: number;
    };
    const total = countResult.total;

    // Get paginated data
    const dataQuery = `
      SELECT * FROM ${this.tableName} 
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];
    const rawResults = db.prepare(dataQuery).all(dataParams) as Record<
      string,
      unknown
    >[];
    const results = rawResults.map((row) => snakeToCamelKeys<IUserEntity>(row));

    return {
      data: results,
      pagination: {
        page,
        limit,
        total,
        hasNext: offset + limit < total,
        hasPrevious: page > 1,
      },
    };
  }

  private async findUsersPaginatedSupabase(
    page: number = 1,
    limit: number = 10,
    filters?: IUserFilters,
  ): Promise<IPaginatedResult<IUserEntity>> {
    const supabase = getSupabaseClient();
    const offset = (page - 1) * limit;
    let query = supabase
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
    if (filters?.emailVerified !== undefined) {
      query = query.eq("email_verified", filters.emailVerified);
    }
    if (filters?.search) {
      query = query.or(
        `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`,
      );
    }

    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order("created_at", { ascending: false });

    if (error) {
      throw new DatabaseException(error.message);
    }

    const total = count || 0;
    return {
      data: (data || []).map((item) => snakeToCamelKeys<IUserEntity>(item)),
      pagination: {
        page,
        limit,
        total,
        hasNext: offset + limit < total,
        hasPrevious: page > 1,
      },
    };
  }

  async updateLastLogin(id: string): Promise<void> {
    if (config.database.provider === "sqlite") {
      this.ensureTableInitialized();
      return this.updateLastLoginSQLite(id);
    } else {
      return this.updateLastLoginSupabase(id);
    }
  }

  private async updateLastLoginSQLite(id: string): Promise<void> {
    const db = SQLiteConfig.getClient();
    const query = `
      UPDATE ${this.tableName}
      SET last_login = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `;

    const now = new Date().toISOString();
    const result = db.prepare(query).run(now, now, id);

    if (result.changes === 0) {
      throw new DatabaseException("User not found or could not be updated");
    }
  }

  private async updateLastLoginSupabase(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from(this.tableName)
      .update({
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      throw new DatabaseException(error.message);
    }
  }

  async isEmailUnique(email: string, excludeId?: string): Promise<boolean> {
    if (config.database.provider === "sqlite") {
      this.ensureTableInitialized();
      return this.isEmailUniqueSQLite(email, excludeId);
    } else {
      return this.isEmailUniqueSupabase(email, excludeId);
    }
  }

  private async isEmailUniqueSQLite(
    email: string,
    excludeId?: string,
  ): Promise<boolean> {
    const db = SQLiteConfig.getClient();
    let query = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE email = ? AND deleted_at IS NULL
    `;
    const params = [email];

    if (excludeId) {
      query += " AND id != ?";
      params.push(excludeId);
    }

    const result = db.prepare(query).get(params) as { count: number };
    return result.count === 0;
  }

  private async isEmailUniqueSupabase(
    email: string,
    excludeId?: string,
  ): Promise<boolean> {
    const supabase = getSupabaseClient();
    let query = supabase
      .from(this.tableName)
      .select("id")
      .eq("email", email)
      .eq("deleted_at", null);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseException(error.message);
    }

    return !data || data.length === 0;
  }

  async findByRole(role: UserRole): Promise<IUserEntity[]> {
    if (config.database.provider === "sqlite") {
      this.ensureTableInitialized();
      return this.findByRoleSQLite(role);
    } else {
      return this.findByRoleSupabase(role);
    }
  }

  private async findByRoleSQLite(role: UserRole): Promise<IUserEntity[]> {
    const db = SQLiteConfig.getClient();
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE role = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;

    const rawResults = db.prepare(query).all(role) as Record<string, unknown>[];
    return rawResults.map((row) => snakeToCamelKeys<IUserEntity>(row));
  }

  private async findByRoleSupabase(role: UserRole): Promise<IUserEntity[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("role", role)
      .eq("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new DatabaseException(error.message);
    }

    return (data || []).map((item) => snakeToCamelKeys<IUserEntity>(item));
  }

  async findByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<IUserEntity | null> {
    if (config.database.provider === "sqlite") {
      this.ensureTableInitialized();
      return this.findByStripeCustomerIdSQLite(stripeCustomerId);
    } else {
      return this.findByStripeCustomerIdSupabase(stripeCustomerId);
    }
  }

  private async findByStripeCustomerIdSQLite(
    stripeCustomerId: string,
  ): Promise<IUserEntity | null> {
    const db = SQLiteConfig.getClient();
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE stripe_customer_id = ? AND deleted_at IS NULL
    `;

    const result = db.prepare(query).get(stripeCustomerId) as Record<
      string,
      unknown
    >;
    return result ? snakeToCamelKeys<IUserEntity>(result) : null;
  }

  private async findByStripeCustomerIdSupabase(
    stripeCustomerId: string,
  ): Promise<IUserEntity | null> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("stripe_customer_id", stripeCustomerId)
      .eq("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw new DatabaseException(error.message);
    }

    return data ? snakeToCamelKeys<IUserEntity>(data) : null;
  }

  async findByStatus(status: UserStatus): Promise<IUserEntity[]> {
    if (config.database.provider === "sqlite") {
      this.ensureTableInitialized();
      return this.findByStatusSQLite(status);
    } else {
      return this.findByStatusSupabase(status);
    }
  }

  private async findByStatusSQLite(status: UserStatus): Promise<IUserEntity[]> {
    const db = SQLiteConfig.getClient();
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE status = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;

    const rawResults = db.prepare(query).all(status) as Record<
      string,
      unknown
    >[];
    return rawResults.map((row) => snakeToCamelKeys<IUserEntity>(row));
  }

  private async findByStatusSupabase(
    status: UserStatus,
  ): Promise<IUserEntity[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("status", status)
      .eq("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new DatabaseException(error.message);
    }

    return (data || []).map((item) => snakeToCamelKeys<IUserEntity>(item));
  }

  async countByRole(role: UserRole): Promise<number> {
    if (config.database.provider === "sqlite") {
      this.ensureTableInitialized();
      return this.countByRoleSQLite(role);
    } else {
      return this.countByRoleSupabase(role);
    }
  }

  private async countByRoleSQLite(role: UserRole): Promise<number> {
    const db = SQLiteConfig.getClient();
    const query = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE role = ? AND deleted_at IS NULL
    `;

    const result = db.prepare(query).get(role) as { count: number };
    return result.count;
  }

  private async countByRoleSupabase(role: UserRole): Promise<number> {
    const supabase = getSupabaseClient();
    const { count, error } = await supabase
      .from(this.tableName)
      .select("*", { count: "exact", head: true })
      .eq("role", role)
      .eq("deleted_at", null);

    if (error) {
      throw new DatabaseException(error.message);
    }

    return count || 0;
  }

  async countByStatus(status: UserStatus): Promise<number> {
    if (config.database.provider === "sqlite") {
      this.ensureTableInitialized();
      return this.countByStatusSQLite(status);
    } else {
      return this.countByStatusSupabase(status);
    }
  }

  private async countByStatusSQLite(status: UserStatus): Promise<number> {
    const db = SQLiteConfig.getClient();
    const query = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE status = ? AND deleted_at IS NULL
    `;

    const result = db.prepare(query).get(status) as { count: number };
    return result.count;
  }

  private async countByStatusSupabase(status: UserStatus): Promise<number> {
    const supabase = getSupabaseClient();
    const { count, error } = await supabase
      .from(this.tableName)
      .select("*", { count: "exact", head: true })
      .eq("status", status)
      .eq("deleted_at", null);

    if (error) {
      throw new DatabaseException(error.message);
    }

    return count || 0;
  }

  async updateEmailVerification(id: string, verified: boolean): Promise<void> {
    if (config.database.provider === "sqlite") {
      this.ensureTableInitialized();
      return this.updateEmailVerificationSQLite(id, verified);
    } else {
      return this.updateEmailVerificationSupabase(id, verified);
    }
  }

  private async updateEmailVerificationSQLite(
    id: string,
    verified: boolean,
  ): Promise<void> {
    const db = SQLiteConfig.getClient();
    const query = `
      UPDATE ${this.tableName}
      SET email_verified = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `;

    const now = new Date().toISOString();
    const result = db.prepare(query).run(verified ? 1 : 0, now, id);

    if (result.changes === 0) {
      throw new DatabaseException("User not found or could not be updated");
    }
  }

  private async updateEmailVerificationSupabase(
    id: string,
    verified: boolean,
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from(this.tableName)
      .update({
        email_verified: verified,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      throw new DatabaseException(error.message);
    }
  }

  async findUnverifiedUsers(olderThanDays: number = 7): Promise<IUserEntity[]> {
    if (config.database.provider === "sqlite") {
      this.ensureTableInitialized();
      return this.findUnverifiedUsersSQLite(olderThanDays);
    } else {
      return this.findUnverifiedUsersSupabase(olderThanDays);
    }
  }

  private async findUnverifiedUsersSQLite(
    olderThanDays: number = 7,
  ): Promise<IUserEntity[]> {
    const db = SQLiteConfig.getClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const query = `
      SELECT * FROM ${this.tableName}
      WHERE email_verified = FALSE 
        AND deleted_at IS NULL
        AND created_at < ?
      ORDER BY created_at DESC
    `;

    const rawResults = db
      .prepare(query)
      .all(cutoffDate.toISOString()) as Record<string, unknown>[];
    return rawResults.map((row) => snakeToCamelKeys<IUserEntity>(row));
  }

  private async findUnverifiedUsersSupabase(
    olderThanDays: number = 7,
  ): Promise<IUserEntity[]> {
    const supabase = getSupabaseClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("email_verified", false)
      .eq("deleted_at", null)
      .lt("created_at", cutoffDate.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      throw new DatabaseException(error.message);
    }

    return (data || []).map((item) => snakeToCamelKeys<IUserEntity>(item));
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    if (config.database.provider === "sqlite") {
      this.ensureTableInitialized();
      return this.updatePasswordSQLite(id, passwordHash);
    } else {
      return this.updatePasswordSupabase(id, passwordHash);
    }
  }

  private async updatePasswordSQLite(
    id: string,
    passwordHash: string,
  ): Promise<void> {
    const db = SQLiteConfig.getClient();
    const query = `
      UPDATE ${this.tableName}
      SET password_hash = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `;

    const now = new Date().toISOString();
    const result = db.prepare(query).run(passwordHash, now, id);

    if (result.changes === 0) {
      throw new DatabaseException("User not found or could not be updated");
    }
  }

  private async updatePasswordSupabase(
    id: string,
    passwordHash: string,
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from(this.tableName)
      .update({
        password_hash: passwordHash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      throw new DatabaseException(error.message);
    }
  }
}
