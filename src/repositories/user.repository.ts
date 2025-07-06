import { Service } from "typedi";
import { BaseRepository } from "./base.repository";
import { IUserEntity } from "../models/entities/user.entity";
import { IUserFilters } from "../models/interfaces/user.interface";
import { UserRole } from "../models/enums/user-roles.enum";
import { UserStatus } from "../models/enums/user-status.enum";
import { DatabaseException } from "../exceptions/database.exception";
import { IPaginatedResult } from "../types/database.types";

@Service()
export class UserRepository extends BaseRepository<IUserEntity> {
  protected tableName = "users";

  async findByEmail(email: string): Promise<IUserEntity | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("email", email)
      .eq("deleted_at", null)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new DatabaseException(error.message);
    }

    return data;
  }

  async findUsersPaginated(
    page: number = 1,
    limit: number = 10,
    filters?: IUserFilters,
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
    if (filters?.email_verified !== undefined) {
      query = query.eq("email_verified", filters.email_verified);
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

  async softDelete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(this.tableName)
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      throw new DatabaseException(error.message);
    }
  }

  async updateLastLogin(id: string): Promise<void> {
    const { error } = await this.supabase
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
    let query = this.supabase
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
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("role", role)
      .eq("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new DatabaseException(error.message);
    }

    return data || [];
  }

  async findByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<IUserEntity | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("stripe_customer_id", stripeCustomerId)
      .eq("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw new DatabaseException(error.message);
    }

    return data;
  }

  async findByStatus(status: UserStatus): Promise<IUserEntity[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("status", status)
      .eq("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new DatabaseException(error.message);
    }

    return data || [];
  }

  async countByRole(role: UserRole): Promise<number> {
    const { count, error } = await this.supabase
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
    const { count, error } = await this.supabase
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
    const { error } = await this.supabase
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
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select("*")
      .eq("email_verified", false)
      .eq("deleted_at", null)
      .lt("created_at", cutoffDate.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      throw new DatabaseException(error.message);
    }

    return data || [];
  }
}
