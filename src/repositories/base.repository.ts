import { Service, Container } from "typedi";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../config/prisma";
import {
  IBaseEntity,
  IPaginationOptions,
  IPaginatedResult,
  IFilterOptions,
  IOrderByOptions,
} from "../types/database.types";

@Service()
export abstract class BaseRepository<T extends IBaseEntity> {
  protected prisma: PrismaClient;

  constructor() {
    // Try to get the Prisma client from the container first (for tests)
    // Fall back to the default prisma client if not available
    try {
      this.prisma = Container.get("prisma") as PrismaClient;
    } catch {
      this.prisma = prisma;
    }
  }

  // Abstract method to get the Prisma model delegate for the specific entity
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected abstract getModel(): any;

  // Create a new record
  async create(data: Omit<T, "id" | "createdAt" | "updatedAt">): Promise<T> {
    const model = this.getModel();
    return await model.create({
      data: {
        ...data,
        deletedAt: null,
      },
    });
  }

  // Find a record by ID
  async findById(id: string): Promise<T | null> {
    const model = this.getModel();
    return await model.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  // Find multiple records with optional filters
  async findMany(options?: {
    filters?: IFilterOptions;
    orderBy?: IOrderByOptions;
    pagination?: IPaginationOptions;
  }): Promise<T[]> {
    const model = this.getModel();
    const { filters = {}, orderBy, pagination } = options || {};

    const where = {
      ...filters,
      deletedAt: null,
    };

    const queryOptions: Record<string, unknown> = { where };

    if (orderBy) {
      queryOptions.orderBy = {
        [orderBy.column]: orderBy.ascending ? "asc" : "desc",
      };
    }

    if (pagination) {
      const page = pagination.page ?? 1;
      const limit = pagination.limit ?? 10;
      queryOptions.skip = (page - 1) * limit;
      queryOptions.take = limit;
    }

    return await model.findMany(queryOptions);
  }

  // Find with pagination
  async findWithPagination(options?: {
    filters?: IFilterOptions;
    orderBy?: IOrderByOptions;
    pagination?: IPaginationOptions;
  }): Promise<IPaginatedResult<T>> {
    const model = this.getModel();
    const {
      filters = {},
      orderBy,
      pagination = { page: 1, limit: 10 },
    } = options || {};

    const where = {
      ...filters,
      deletedAt: null,
    };

    const queryOptions: Record<string, unknown> = { where };

    if (orderBy) {
      queryOptions.orderBy = {
        [orderBy.column]: orderBy.ascending ? "asc" : "desc",
      };
    }

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const skip = (page - 1) * limit;
    queryOptions.skip = skip;
    queryOptions.take = limit;

    const [data, total] = await Promise.all([
      model.findMany(queryOptions),
      model.count({ where }),
    ]);

    const hasNext = skip + limit < total;
    const hasPrevious = page > 1;

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        hasNext,
        hasPrevious,
      },
    };
  }

  // Update a record
  async update(
    id: string,
    data: Partial<Omit<T, "id" | "createdAt" | "updatedAt">>,
  ): Promise<T> {
    const model = this.getModel();
    return await model.update({
      where: {
        id,
        deletedAt: null,
      },
      data,
    });
  }

  // Soft delete a record
  async softDelete(id: string): Promise<void> {
    const model = this.getModel();
    await model.update({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  // Hard delete a record (permanent)
  async hardDelete(id: string): Promise<void> {
    const model = this.getModel();
    await model.delete({
      where: { id },
    });
  }

  // Count records
  async count(filters?: IFilterOptions): Promise<number> {
    const model = this.getModel();
    const where = {
      ...filters,
      deletedAt: null,
    };
    return await model.count({ where });
  }

  // Check if record exists
  async exists(id: string): Promise<boolean> {
    const record = await this.findById(id);
    return record !== null;
  }

  // Find first record matching filters
  async findFirst(filters?: IFilterOptions): Promise<T | null> {
    const model = this.getModel();
    const where = {
      ...filters,
      deletedAt: null,
    };
    return await model.findFirst({ where });
  }
}
