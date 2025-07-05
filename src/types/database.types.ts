// Database type definitions will be generated from Supabase schema
// For now, we'll define a basic structure that can be extended

export interface Database {
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Base entity interface
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Common field types
export type UUID = string;
export type Timestamp = string;
export type Json = Record<string, any>;

// Query result types
export interface QueryResult<T> {
  data: T | null;
  error: QueryError | null;
  count?: number;
}

export interface QueryError {
  message: string;
  code: string;
  details?: string;
  hint?: string;
}

// Pagination types
export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
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
export interface FilterOptions {
  [key: string]: any;
}

export interface OrderByOptions {
  column: string;
  ascending?: boolean;
}