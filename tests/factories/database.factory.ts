import {
  IPaginationOptions,
  IPaginatedResult,
  IFilterOptions,
  IOrderByOptions,
} from "@/types/database.types";
import { IBaseEntity } from "@/models/entities/base.entity";
import { BaseFactory } from "./base.factory";

export class DatabaseFactory {
  static createPaginationOptions(
    overrides: Partial<IPaginationOptions> = {}
  ): IPaginationOptions {
    return {
      page: 1,
      limit: 10,
      ...overrides,
    };
  }

  static createPaginationResult<T>(
    data: T[],
    options: IPaginationOptions,
    total: number,
    overrides: Partial<IPaginatedResult<T>> = {}
  ): IPaginatedResult<T> {
    const totalPages = Math.ceil(total / (options.limit || 10));
    const hasNextPage = (options.page || 1) < totalPages;
    const hasPreviousPage = (options.page || 1) > 1;

    return {
      data,
      pagination: {
        page: options.page || 1,
        limit: options.limit || 10,
        total,
        hasNext: hasNextPage,
        hasPrevious: hasPreviousPage,
      },
      ...overrides,
    };
  }

  static createFilterOptions(
    overrides: Partial<IFilterOptions> = {}
  ): IFilterOptions {
    return {
      where: {},
      ...overrides,
    };
  }

  static createOrderOptions(
    overrides: Partial<IOrderByOptions> = {}
  ): IOrderByOptions {
    return {
      column: "created_at",
      ascending: false,
      ...overrides,
    };
  }

  static createSupabaseResponse<T>(data: T[], error: null | Error = null) {
    return {
      data: error ? null : data,
      error,
      count: error ? null : data.length,
      status: error ? 400 : 200,
      statusText: error ? "Bad Request" : "OK",
    };
  }

  static createSupabaseError(message: string, code = "PGRST000") {
    return {
      message,
      details: null,
      hint: null,
      code,
    };
  }

  static createEmptyPaginationResult<T>(
    options: IPaginationOptions,
    overrides: Partial<IPaginatedResult<T>> = {}
  ): IPaginatedResult<T> {
    return this.createPaginationResult<T>([], options, 0, overrides);
  }

  static createPaginatedEntities(
    count: number,
    options: IPaginationOptions,
    entityFactory: (index: number) => IBaseEntity = index =>
      BaseFactory.createBaseEntity({ id: `entity-${index}` })
  ): IPaginatedResult<IBaseEntity> {
    const entities = Array.from({ length: count }, (_, index) =>
      entityFactory(index)
    );
    return this.createPaginationResult(entities, options, count);
  }

  static createDatabaseConnectionError() {
    return this.createSupabaseError("connection to server failed");
  }

  static createDatabaseTimeoutError() {
    return this.createSupabaseError("query timeout", "PGRST001");
  }

  static createDatabaseConstraintError() {
    return this.createSupabaseError(
      "duplicate key value violates unique constraint",
      "PGRST002"
    );
  }
}
