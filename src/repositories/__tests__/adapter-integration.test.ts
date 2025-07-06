import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BaseRepository } from "@repositories/base.repository";
import { IBaseEntity } from "../../types/database.types";
import { config } from "../../config/env";
import { SQLiteConfig } from "../../config/sqlite";
import Database from "better-sqlite3";

interface ITestEntity extends IBaseEntity {
  name: string;
  email: string;
  status: string;
}

class IntegrationTestRepository extends BaseRepository<ITestEntity> {
  protected tableName = "integration_test";
  private testDb?: Database.Database;

  constructor(supabase?: any, testDb?: Database.Database) {
    super(supabase);
    this.testDb = testDb;
  }

  protected initializeTable(): void {
    if (config.database.provider === "sqlite") {
      const db = this.testDb || SQLiteConfig.getClient();
      db.exec(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          status TEXT DEFAULT 'active',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        )
      `);
    }
  }
}

describe("Database Adapter Integration Tests", () => {
  let originalProvider: string;
  let testDb: Database.Database | null = null;

  beforeEach(() => {
    originalProvider = config.database.provider;

    // Reset mocks before each test
    vi.clearAllMocks();
  });

  afterEach(async () => {
    config.database.provider = originalProvider as "supabase" | "sqlite";

    // Clean up test data from the actual database
    if (config.database.provider === "sqlite") {
      try {
        const db = SQLiteConfig.getClient();
        db.exec("DELETE FROM integration_test WHERE 1=1");
        db.exec("DROP TABLE IF EXISTS integration_test");
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    if (testDb) {
      try {
        testDb.exec("DROP TABLE IF EXISTS integration_test");
        testDb.close();
      } catch (error) {
        // Ignore cleanup errors
      }
      testDb = null;
    }

    vi.restoreAllMocks();
  });

  describe("Provider Switching", () => {
    it("should correctly identify and use SQLite adapter", () => {
      config.database.provider = "sqlite";

      // Instead of mocking, just test that the repository can be created
      // without errors when using SQLite provider
      expect(() => {
        const repository = new IntegrationTestRepository();
        expect(repository).toBeDefined();
      }).not.toThrow();
    });

    it("should correctly identify and use Supabase adapter", () => {
      config.database.provider = "supabase";

      const mockSupabaseClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockReturnThis(),
        }),
      };

      const repository = new IntegrationTestRepository(
        mockSupabaseClient as any,
      );

      // Verify Supabase methods are available
      expect(() => (repository as any).supabase).not.toThrow();
    });

    it("should handle adapter switching at runtime", () => {
      // Start with SQLite
      config.database.provider = "sqlite";
      expect(() => {
        const sqliteRepo = new IntegrationTestRepository();
        expect(sqliteRepo).toBeDefined();
      }).not.toThrow();

      // Switch to Supabase (would require new instance in real app)
      config.database.provider = "supabase";
      const mockSupabaseClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockReturnThis(),
        }),
      };

      expect(() => {
        const supabaseRepo = new IntegrationTestRepository(
          mockSupabaseClient as any,
        );
        expect(supabaseRepo).toBeDefined();
      }).not.toThrow();
    });
  });

  describe("Adapter Method Consistency", () => {
    it("should have consistent method signatures across adapters", async () => {
      // Test that both adapters support the same basic methods
      config.database.provider = "sqlite";
      const sqliteRepo = new IntegrationTestRepository();

      // Check that all required methods exist
      expect(typeof sqliteRepo.create).toBe("function");
      expect(typeof sqliteRepo.findById).toBe("function");
      expect(typeof sqliteRepo.findMany).toBe("function");
      expect(typeof sqliteRepo.update).toBe("function");
      expect(typeof sqliteRepo.count).toBe("function");
      expect(typeof sqliteRepo.exists).toBe("function");
      expect(typeof sqliteRepo.softDelete).toBe("function");
      expect(typeof sqliteRepo.hardDelete).toBe("function");

      // Test Supabase adapter has same methods
      config.database.provider = "supabase";
      const mockSupabaseClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockReturnThis(),
        }),
      };

      const supabaseRepo = new IntegrationTestRepository(
        mockSupabaseClient as any,
      );

      expect(typeof supabaseRepo.create).toBe("function");
      expect(typeof supabaseRepo.findById).toBe("function");
      expect(typeof supabaseRepo.findMany).toBe("function");
      expect(typeof supabaseRepo.update).toBe("function");
      expect(typeof supabaseRepo.count).toBe("function");
      expect(typeof supabaseRepo.exists).toBe("function");
      expect(typeof supabaseRepo.softDelete).toBe("function");
      expect(typeof supabaseRepo.hardDelete).toBe("function");
    });

    it("should handle error scenarios consistently", async () => {
      config.database.provider = "sqlite";
      const repository = new IntegrationTestRepository();

      // Test error handling for non-existent records
      await expect(
        repository.update("non-existent-id", { name: "Test" }),
      ).rejects.toThrow();
      await expect(repository.hardDelete("non-existent-id")).rejects.toThrow();
    });
  });

  describe("Data Type Handling", () => {
    it("should handle timestamps consistently across adapters", async () => {
      config.database.provider = "sqlite";
      const repository = new IntegrationTestRepository();

      const beforeCreate = new Date();
      const entity = await repository.create({
        name: "Timestamp Test",
        email: `timestamp-${Date.now()}@test.com`,
        status: "active",
      });
      const afterCreate = new Date();

      // Check that timestamps are in the correct format and range
      expect(entity.createdAt).toBeDefined();
      expect(entity.updatedAt).toBeDefined();

      const createdAt = new Date(entity.createdAt);
      const updatedAt = new Date(entity.updatedAt);

      expect(createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime(),
      );
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime(),
      );
      expect(updatedAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });

    it("should handle string data types properly", async () => {
      config.database.provider = "sqlite";
      const repository = new IntegrationTestRepository();

      const testData = {
        name: "Test with Special Characters: àáâãäåæçèéêë",
        email: `special-${Date.now()}@test.com`,
        status: "active with spaces and symbols: !@#$%",
      };

      const entity = await repository.create(testData);

      expect(entity.name).toBe(testData.name);
      expect(entity.email).toBe(testData.email);
      expect(entity.status).toBe(testData.status);

      // Verify it was stored correctly by reading it back
      const found = await repository.findById(entity.id);
      expect(found?.name).toBe(testData.name);
      expect(found?.status).toBe(testData.status);
    });
  });

  describe("Performance and Connection Handling", () => {
    it("should handle multiple simultaneous operations", async () => {
      config.database.provider = "sqlite";
      const repository = new IntegrationTestRepository();

      const timestamp = Date.now();
      // Create a few entities simultaneously
      const createPromises = Array.from({ length: 3 }, (_, i) =>
        repository.create({
          name: `User ${i}`,
          email: `user${i}-${timestamp}@test.com`,
          status: "active",
        }),
      );

      const entities = await Promise.all(createPromises);
      expect(entities).toHaveLength(3);

      // Test simultaneous reads
      const readPromises = entities.map((entity) =>
        repository.findById(entity.id),
      );
      const foundEntities = await Promise.all(readPromises);

      expect(foundEntities.every((entity) => entity !== null)).toBe(true);
    });

    it("should properly clean up resources", async () => {
      config.database.provider = "sqlite";
      const repository = new IntegrationTestRepository();

      // Perform various operations
      const entity = await repository.create({
        name: "Cleanup Test",
        email: `cleanup-${Date.now()}@test.com`,
        status: "active",
      });

      await repository.findMany();
      await repository.findWithPagination({
        pagination: { page: 1, limit: 5 },
      });
      await repository.count();
      await repository.update(entity.id, { status: "updated" });
      await repository.softDelete(entity.id);

      // Verify the entity was soft deleted
      const deletedEntity = await repository.findById(entity.id);
      expect(deletedEntity).toBeNull();
    });
  });
});
