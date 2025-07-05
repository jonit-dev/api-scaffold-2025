import { describe, it, expect, beforeEach, vi } from "vitest";
import { BaseRepository } from "@repositories/base.repository";
import { IBaseEntity } from "@models/entities/base.entity";
import { BaseFactory } from "../../factories/base.factory";
import { DatabaseFactory } from "../../factories/database.factory";
import { TestHelpers } from "../../utils/test.helpers";

interface ITestEntity extends IBaseEntity {
  name: string;
  email: string;
}

class TestRepository extends BaseRepository<ITestEntity> {
  protected tableName = "test_table";
}

describe("BaseRepository", () => {
  let repository: TestRepository;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(() => {
    const createQueryBuilder = (): any => {
      const builder = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        like: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockReturnThis(),
        throwOnError: vi.fn().mockReturnThis(),
      };

      // Make all methods return the same builder object to support chaining
      Object.keys(builder).forEach(key => {
        if (typeof (builder as any)[key] === "function") {
          (builder as any)[key].mockReturnValue(builder);
        }
      });

      return builder;
    };

    mockQueryBuilder = createQueryBuilder();

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    TestHelpers.setupMockSupabaseClient(mockSupabaseClient);
    repository = new TestRepository();
    // Override the supabase client with our mock
    (repository as any).supabase = mockSupabaseClient;
  });

  describe("findMany", () => {
    it("should return all entities when no pagination is provided", async () => {
      const testEntities = [
        {
          ...BaseFactory.createBaseEntity(),
          name: "Test 1",
          email: "test1@example.com",
        },
        {
          ...BaseFactory.createBaseEntity(),
          name: "Test 2",
          email: "test2@example.com",
        },
      ];

      mockQueryBuilder.eq.mockResolvedValue({
        data: testEntities,
        error: null,
      });

      const result = await repository.findMany();

      expect(result).toEqual(testEntities);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("test_table");
      expect(mockQueryBuilder.select).toHaveBeenCalledWith();
    });

    it("should exclude soft-deleted entities by default", async () => {
      const testEntities = [
        {
          ...BaseFactory.createBaseEntity(),
          name: "Test 1",
          email: "test1@example.com",
        },
      ];

      mockQueryBuilder.eq.mockResolvedValue({
        data: testEntities,
        error: null,
      });

      await repository.findMany();

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith("deleted_at", null);
    });

    it("should handle database errors", async () => {
      mockQueryBuilder.eq.mockResolvedValue({
        data: null,
        error: { message: "Database connection failed" },
      });

      await expect(repository.findMany()).rejects.toThrow(
        "Database connection failed",
      );
    });
  });

  describe("findById", () => {
    it("should return entity when found", async () => {
      const testEntity = {
        ...BaseFactory.createBaseEntity(),
        name: "Test",
        email: "test@example.com",
      };

      mockQueryBuilder.single.mockResolvedValue({
        data: testEntity,
        error: null,
      });

      const result = await repository.findById(testEntity.id);

      expect(result).toEqual(testEntity);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith("id", testEntity.id);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith("deleted_at", null);
      expect(mockQueryBuilder.single).toHaveBeenCalled();
    });

    it("should return null when entity not found", async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" }, // Not found error
      });

      const result = await repository.findById("non-existent-id");

      expect(result).toBeNull();
    });

    it("should throw error for other database errors", async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: "Database connection failed", code: "PGRST000" },
      });

      await expect(repository.findById("test-id")).rejects.toThrow(
        "Database connection failed",
      );
    });
  });

  describe("create", () => {
    it("should create new entity successfully", async () => {
      const newEntity = { name: "New Test", email: "newtest@example.com" };
      const createdEntity = { ...BaseFactory.createBaseEntity(), ...newEntity };

      mockQueryBuilder.single.mockResolvedValue({
        data: createdEntity,
        error: null,
      });

      const result = await repository.create(newEntity);

      expect(result).toEqual(createdEntity);
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          ...newEntity,
          created_at: expect.any(String),
          updated_at: expect.any(String),
        }),
      );
      expect(mockQueryBuilder.select).toHaveBeenCalledWith();
      expect(mockQueryBuilder.single).toHaveBeenCalled();
    });

    it("should handle creation errors", async () => {
      const newEntity = { name: "New Test", email: "newtest@example.com" };

      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: "Duplicate key violation" },
      });

      await expect(repository.create(newEntity)).rejects.toThrow(
        "Duplicate key violation",
      );
    });
  });

  describe("update", () => {
    it("should update entity successfully", async () => {
      const entityId = "test-id";
      const updateData = { name: "Updated Test" };
      const updatedEntity = {
        ...BaseFactory.createBaseEntity(),
        ...updateData,
      };

      mockQueryBuilder.single.mockResolvedValue({
        data: updatedEntity,
        error: null,
      });

      const result = await repository.update(entityId, updateData);

      expect(result).toEqual(updatedEntity);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          ...updateData,
          updated_at: expect.any(String),
        }),
      );
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith("id", entityId);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith("deleted_at", null);
    });

    it("should handle update errors", async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: "Update failed" },
      });

      await expect(
        repository.update("test-id", { name: "Updated" }),
      ).rejects.toThrow("Update failed");
    });
  });

  describe("hardDelete", () => {
    it("should hard delete entity successfully", async () => {
      const entityId = "test-id";

      mockQueryBuilder.eq.mockResolvedValue({
        data: null,
        error: null,
      });

      await repository.hardDelete(entityId);

      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith("id", entityId);
    });

    it("should handle deletion errors", async () => {
      mockQueryBuilder.eq.mockResolvedValue({
        data: null,
        error: { message: "Foreign key constraint violation" },
      });

      await expect(repository.hardDelete("test-id")).rejects.toThrow(
        "Foreign key constraint violation",
      );
    });
  });

  describe("findWithPagination", () => {
    it("should return paginated results", async () => {
      const testEntities = BaseFactory.createMultipleEntities(5);
      const paginationOptions = { page: 1, limit: 3 };

      mockQueryBuilder.range.mockResolvedValue({
        data: testEntities.slice(0, 3),
        error: null,
        count: 5,
      });

      const result = await repository.findWithPagination({
        pagination: paginationOptions,
      });

      expect(result.data).toEqual(testEntities.slice(0, 3));
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(3);
      expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 2);
    });

    it("should handle empty results", async () => {
      const paginationOptions = { page: 1, limit: 10 };

      mockQueryBuilder.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      const result = await repository.findWithPagination({
        pagination: paginationOptions,
      });

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe("count", () => {
    it("should return total count", async () => {
      mockQueryBuilder.eq.mockResolvedValue({
        data: null,
        error: null,
        count: 15,
      });

      const result = await repository.count();

      expect(result).toBe(15);
      expect(mockQueryBuilder.select).toHaveBeenCalledWith("*", {
        count: "exact",
        head: true,
      });
    });

    it("should handle count errors", async () => {
      mockQueryBuilder.eq.mockResolvedValue({
        data: null,
        error: { message: "Count failed" },
        count: null,
      });

      await expect(repository.count()).rejects.toThrow("Count failed");
    });
  });

  describe("exists", () => {
    it("should return true when entity exists", async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: "test-id" },
        error: null,
      });

      const result = await repository.exists("test-id");

      expect(result).toBe(true);
    });

    it("should return false when entity does not exist", async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116" },
      });

      const result = await repository.exists("non-existent-id");

      expect(result).toBe(false);
    });
  });
});
