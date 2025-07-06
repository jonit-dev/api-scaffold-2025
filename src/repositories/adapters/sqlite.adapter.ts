import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import {
  IBaseEntity,
  IPaginationOptions,
  IPaginatedResult,
  IFilterOptions,
  IOrderByOptions,
} from "../../types/database.types";
import { DatabaseException } from "../../exceptions/database.exception";
import {
  camelToSnakeKeys,
  snakeToCamelKeys,
} from "../../utils/case-conversion.utils";
import { IDatabaseAdapter } from "./supabase.adapter";

export class SQLiteAdapter<T extends IBaseEntity>
  implements IDatabaseAdapter<T>
{
  constructor(private db: Database.Database) {}

  private executeQuery<R = unknown>(
    query: string,
    params: unknown[] = [],
    operation: "get" | "all" | "run" = "all",
  ): R {
    try {
      const stmt = this.db.prepare(query);

      switch (operation) {
        case "get":
          return stmt.get(params) as R;
        case "all":
          return stmt.all(params) as R;
        case "run":
          return stmt.run(params) as R;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      throw new DatabaseException(
        `Database operation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async create(
    data: Omit<T, "id" | "createdAt" | "updatedAt">,
    tableName: string,
  ): Promise<T> {
    const snakeData = camelToSnakeKeys({
      ...data,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }) as Record<string, unknown>;

    const columns = Object.keys(snakeData);
    const placeholders = columns.map(() => "?").join(", ");
    const values = Object.values(snakeData);

    const query = `
      INSERT INTO ${tableName} (${columns.join(", ")})
      VALUES (${placeholders})
    `;

    const result = this.executeQuery(
      query,
      values,
      "run",
    ) as Database.RunResult;

    if (result.changes === 0) {
      throw new DatabaseException("Failed to create record");
    }

    const created = await this.findById(snakeData.id as string, tableName);
    if (!created) {
      throw new DatabaseException("Failed to retrieve created record");
    }
    return created;
  }

  async findById(id: string, tableName: string): Promise<T | null> {
    const query = `SELECT * FROM ${tableName} WHERE id = ? AND deleted_at IS NULL`;
    const result = this.executeQuery(query, [id], "get") as Record<
      string,
      unknown
    >;

    return result ? snakeToCamelKeys<T>(result) : null;
  }

  async findMany(
    options: {
      filters?: IFilterOptions;
      orderBy?: IOrderByOptions;
      pagination?: IPaginationOptions;
    },
    tableName: string,
  ): Promise<T[]> {
    const whereConditions = ["deleted_at IS NULL"];
    const params: unknown[] = [];

    // Apply filters
    if (options?.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          whereConditions.push(`${key} = ?`);
          params.push(value);
        }
      });
    }

    const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

    // Build order clause
    let orderClause = "ORDER BY created_at DESC";
    if (options?.orderBy) {
      const direction = options.orderBy.ascending ? "ASC" : "DESC";
      orderClause = `ORDER BY ${options.orderBy.column} ${direction}`;
    }

    // Build pagination clause
    let paginationClause = "";
    const paginationParams: unknown[] = [];
    if (options?.pagination) {
      const { page = 1, limit = 10 } = options.pagination;
      const offset = (page - 1) * limit;
      paginationClause = `LIMIT ? OFFSET ?`;
      paginationParams.push(limit, offset);
    }

    const query = `
      SELECT * FROM ${tableName}
      ${whereClause}
      ${orderClause}
      ${paginationClause}
    `;

    const allParams = [...params, ...paginationParams];
    const results = this.executeQuery(query, allParams, "all") as Record<
      string,
      unknown
    >[];

    return results.map((item) => snakeToCamelKeys<T>(item));
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

    const whereConditions = ["deleted_at IS NULL"];
    const params: unknown[] = [];

    // Apply filters
    if (options?.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          whereConditions.push(`${key} = ?`);
          params.push(value);
        }
      });
    }

    const whereClause = `WHERE ${whereConditions.join(" AND ")}`;

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`;
    const countResult = this.executeQuery(countQuery, params, "get") as {
      total: number;
    };
    const total = countResult.total;

    // Build order clause
    let orderClause = "ORDER BY created_at DESC";
    if (options?.orderBy) {
      const direction = options.orderBy.ascending ? "ASC" : "DESC";
      orderClause = `ORDER BY ${options.orderBy.column} ${direction}`;
    }

    // Get paginated data
    const dataQuery = `
      SELECT * FROM ${tableName}
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];
    const results = this.executeQuery(dataQuery, dataParams, "all") as Record<
      string,
      unknown
    >[];

    return {
      data: results.map((item) => snakeToCamelKeys<T>(item)),
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
    const snakeData = camelToSnakeKeys({
      ...data,
      updated_at: new Date().toISOString(),
    }) as Record<string, unknown>;

    const columns = Object.keys(snakeData);
    const setClause = columns.map((col) => `${col} = ?`).join(", ");
    const values = [...Object.values(snakeData), id];

    const query = `
      UPDATE ${tableName}
      SET ${setClause}
      WHERE id = ? AND deleted_at IS NULL
    `;

    const result = this.executeQuery(
      query,
      values,
      "run",
    ) as Database.RunResult;

    if (result.changes === 0) {
      throw new DatabaseException("Record not found or could not be updated");
    }

    const updated = await this.findById(id, tableName);
    if (!updated) {
      throw new DatabaseException("Failed to retrieve updated record");
    }
    return updated;
  }

  async softDelete(id: string, tableName: string): Promise<void> {
    const query = `
      UPDATE ${tableName}
      SET deleted_at = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `;

    const now = new Date().toISOString();
    const result = this.executeQuery(
      query,
      [now, now, id],
      "run",
    ) as Database.RunResult;

    if (result.changes === 0) {
      throw new DatabaseException("Record not found or already deleted");
    }
  }

  async hardDelete(id: string, tableName: string): Promise<void> {
    const query = `DELETE FROM ${tableName} WHERE id = ?`;
    const result = this.executeQuery(query, [id], "run") as Database.RunResult;

    if (result.changes === 0) {
      throw new DatabaseException("Record not found");
    }
  }

  async count(
    filters: IFilterOptions | undefined,
    tableName: string,
  ): Promise<number> {
    const whereConditions = ["deleted_at IS NULL"];
    const params: unknown[] = [];

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          whereConditions.push(`${key} = ?`);
          params.push(value);
        }
      });
    }

    const whereClause = `WHERE ${whereConditions.join(" AND ")}`;
    const query = `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`;
    const result = this.executeQuery(query, params, "get") as { total: number };

    return result.total;
  }

  async findFirst(
    filters: IFilterOptions | undefined,
    tableName: string,
  ): Promise<T | null> {
    const whereConditions = ["deleted_at IS NULL"];
    const params: unknown[] = [];

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          whereConditions.push(`${key} = ?`);
          params.push(value);
        }
      });
    }

    const whereClause = `WHERE ${whereConditions.join(" AND ")}`;
    const query = `SELECT * FROM ${tableName} ${whereClause} LIMIT 1`;
    const result = this.executeQuery(query, params, "get") as Record<
      string,
      unknown
    >;

    return result ? snakeToCamelKeys<T>(result) : null;
  }
}
