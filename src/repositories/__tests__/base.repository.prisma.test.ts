import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { BaseRepository } from "@repositories/base.repository";
import { IBaseEntity } from "../../types/database.types";

interface ITestEntity extends IBaseEntity {
  name: string;
  email: string;
}

class TestRepository extends BaseRepository<ITestEntity> {
  protected getModel() {
    return this.mockModel;
  }

  // Expose mock model for test access
  mockModel: any;

  constructor() {
    super();
    this.mockModel = {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    };
  }
}

describe("BaseRepository with Prisma", () => {
  let repository: TestRepository;

  beforeEach(() => {
    repository = new TestRepository();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new entity successfully", async () => {
      const newEntityData = {
        name: "Test Entity",
        email: "test@example.com",
      };

      const createdEntity: ITestEntity = {
        id: "test-id",
        name: "Test Entity",
        email: "test@example.com",
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T00:00:00.000Z",
      };

      repository.mockModel.create.mockResolvedValue(createdEntity);

      const result = await repository.create(newEntityData);

      expect(result).toEqual(createdEntity);
      expect(repository.mockModel.create).toHaveBeenCalledWith({
        data: {
          ...newEntityData,
          deletedAt: null,
        },
      });
    });

    it("should handle creation errors", async () => {
      const newEntityData = {
        name: "Test Entity",
        email: "test@example.com",
      };

      repository.mockModel.create.mockRejectedValue(
        new Error("Unique constraint violation"),
      );

      await expect(repository.create(newEntityData)).rejects.toThrow(
        "Unique constraint violation",
      );
    });
  });

  describe("findById", () => {
    it("should return entity when found", async () => {
      const testEntity: ITestEntity = {
        id: "test-id",
        name: "Test Entity",
        email: "test@example.com",
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T00:00:00.000Z",
      };

      repository.mockModel.findFirst.mockResolvedValue(testEntity);

      const result = await repository.findById("test-id");

      expect(result).toEqual(testEntity);
      expect(repository.mockModel.findFirst).toHaveBeenCalledWith({
        where: {
          id: "test-id",
          deletedAt: null,
        },
      });
    });

    it("should return null when entity not found", async () => {
      repository.mockModel.findFirst.mockResolvedValue(null);

      const result = await repository.findById("non-existent-id");

      expect(result).toBeNull();
    });
  });

  describe("findMany", () => {
    it("should return all entities with default options", async () => {
      const testEntities: ITestEntity[] = [
        {
          id: "test-id-1",
          name: "Test Entity 1",
          email: "test1@example.com",
          createdAt: "2023-01-01T00:00:00.000Z",
          updatedAt: "2023-01-01T00:00:00.000Z",
        },
        {
          id: "test-id-2",
          name: "Test Entity 2",
          email: "test2@example.com",
          createdAt: "2023-01-01T00:00:00.000Z",
          updatedAt: "2023-01-01T00:00:00.000Z",
        },
      ];

      repository.mockModel.findMany.mockResolvedValue(testEntities);

      const result = await repository.findMany();

      expect(result).toEqual(testEntities);
      expect(repository.mockModel.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
        },
      });
    });

    it("should apply filters correctly", async () => {
      const testEntities: ITestEntity[] = [];
      repository.mockModel.findMany.mockResolvedValue(testEntities);

      await repository.findMany({
        filters: { email: "test@example.com" },
        orderBy: { column: "createdAt", ascending: false },
        pagination: { page: 1, limit: 10 },
      });

      expect(repository.mockModel.findMany).toHaveBeenCalledWith({
        where: {
          email: "test@example.com",
          deletedAt: null,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: 0,
        take: 10,
      });
    });
  });

  describe("findWithPagination", () => {
    it("should return paginated results with metadata", async () => {
      const testEntities: ITestEntity[] = [
        {
          id: "test-id-1",
          name: "Test Entity 1",
          email: "test1@example.com",
          createdAt: "2023-01-01T00:00:00.000Z",
          updatedAt: "2023-01-01T00:00:00.000Z",
        },
      ];

      repository.mockModel.findMany.mockResolvedValue(testEntities);
      repository.mockModel.count.mockResolvedValue(5);

      const result = await repository.findWithPagination({
        pagination: { page: 1, limit: 10 },
      });

      expect(result.data).toEqual(testEntities);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrevious).toBe(false);
    });

    it("should calculate pagination correctly for multiple pages", async () => {
      const testEntities: ITestEntity[] = [];
      repository.mockModel.findMany.mockResolvedValue(testEntities);
      repository.mockModel.count.mockResolvedValue(25);

      const result = await repository.findWithPagination({
        pagination: { page: 2, limit: 10 },
      });

      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrevious).toBe(true);
    });
  });

  describe("update", () => {
    it("should update entity successfully", async () => {
      const updateData = { name: "Updated Name" };
      const updatedEntity: ITestEntity = {
        id: "test-id",
        name: "Updated Name",
        email: "test@example.com",
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T01:00:00.000Z",
      };

      repository.mockModel.update.mockResolvedValue(updatedEntity);

      const result = await repository.update("test-id", updateData);

      expect(result).toEqual(updatedEntity);
      expect(repository.mockModel.update).toHaveBeenCalledWith({
        where: {
          id: "test-id",
          deletedAt: null,
        },
        data: updateData,
      });
    });

    it("should handle update errors", async () => {
      repository.mockModel.update.mockRejectedValue(
        new Error("Record not found"),
      );

      await expect(
        repository.update("test-id", { name: "Updated" }),
      ).rejects.toThrow("Record not found");
    });
  });

  describe("softDelete", () => {
    it("should soft delete entity by setting deletedAt", async () => {
      repository.mockModel.update.mockResolvedValue({});

      await repository.softDelete("test-id");

      expect(repository.mockModel.update).toHaveBeenCalledWith({
        where: {
          id: "test-id",
          deletedAt: null,
        },
        data: {
          deletedAt: expect.any(Date),
        },
      });
    });
  });

  describe("hardDelete", () => {
    it("should permanently delete entity", async () => {
      repository.mockModel.delete.mockResolvedValue({});

      await repository.hardDelete("test-id");

      expect(repository.mockModel.delete).toHaveBeenCalledWith({
        where: { id: "test-id" },
      });
    });
  });

  describe("count", () => {
    it("should return count of entities", async () => {
      repository.mockModel.count.mockResolvedValue(15);

      const result = await repository.count();

      expect(result).toBe(15);
      expect(repository.mockModel.count).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
        },
      });
    });

    it("should apply filters when counting", async () => {
      repository.mockModel.count.mockResolvedValue(5);

      const result = await repository.count({ email: "test@example.com" });

      expect(result).toBe(5);
      expect(repository.mockModel.count).toHaveBeenCalledWith({
        where: {
          email: "test@example.com",
          deletedAt: null,
        },
      });
    });
  });

  describe("exists", () => {
    it("should return true when entity exists", async () => {
      const testEntity: ITestEntity = {
        id: "test-id",
        name: "Test Entity",
        email: "test@example.com",
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T00:00:00.000Z",
      };

      repository.mockModel.findFirst.mockResolvedValue(testEntity);

      const result = await repository.exists("test-id");

      expect(result).toBe(true);
    });

    it("should return false when entity does not exist", async () => {
      repository.mockModel.findFirst.mockResolvedValue(null);

      const result = await repository.exists("non-existent-id");

      expect(result).toBe(false);
    });
  });

  describe("findFirst", () => {
    it("should return first entity matching filters", async () => {
      const testEntity: ITestEntity = {
        id: "test-id",
        name: "Test Entity",
        email: "test@example.com",
        createdAt: "2023-01-01T00:00:00.000Z",
        updatedAt: "2023-01-01T00:00:00.000Z",
      };

      repository.mockModel.findFirst.mockResolvedValue(testEntity);

      const result = await repository.findFirst({ email: "test@example.com" });

      expect(result).toEqual(testEntity);
      expect(repository.mockModel.findFirst).toHaveBeenCalledWith({
        where: {
          email: "test@example.com",
          deletedAt: null,
        },
      });
    });

    it("should return null when no entity matches filters", async () => {
      repository.mockModel.findFirst.mockResolvedValue(null);

      const result = await repository.findFirst({
        email: "nonexistent@example.com",
      });

      expect(result).toBeNull();
    });
  });
});
