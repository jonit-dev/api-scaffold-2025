// Database type definitions will be generated from Supabase schema
// For now, we'll define a basic structure that can be extended

export interface IDatabase {
  public: {
    Tables: {
      health_check: {
        Row: {
          id: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          status: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          status?: string;
          created_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          password_hash: string;
          role: string;
          status: string;
          email_verified: boolean;
          phone?: string;
          avatar_url?: string;
          last_login?: string;
          created_at: string;
          updated_at: string;
          deleted_at?: string;
        };
        Insert: {
          id?: string;
          email: string;
          first_name: string;
          last_name: string;
          password_hash: string;
          role?: string;
          status?: string;
          email_verified?: boolean;
          phone?: string;
          avatar_url?: string;
          last_login?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string;
          last_name?: string;
          password_hash?: string;
          role?: string;
          status?: string;
          email_verified?: boolean;
          phone?: string;
          avatar_url?: string;
          last_login?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: "admin" | "user" | "moderator";
      user_status: "active" | "inactive" | "suspended" | "pending_verification";
    };
  };
}

// Base entity interface
export interface IBaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// Common field types
export type UUID = string;
export type Timestamp = string;
export type Json = Record<string, unknown>;

// Query result types
export interface IQueryResult<T> {
  data: T | null;
  error: IQueryError | null;
  count?: number;
}

export interface IQueryError {
  message: string;
  code: string;
  details?: string;
  hint?: string;
}

// Pagination types
export interface IPaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface IPaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// Filter types
export interface IFilterOptions {
  [key: string]: unknown;
}

export interface IOrderByOptions {
  column: string;
  ascending?: boolean;
}
