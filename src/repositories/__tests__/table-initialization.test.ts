import { BaseRepository } from "@repositories/base.repository";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../../config/env";
import { SQLiteConfig } from "../../config/sqlite";
import { IBaseEntity } from "../../types/database.types";

interface ITestEntity extends IBaseEntity {
  name: string;
  email: string;
}

class TestTableRepository extends BaseRepository<ITestEntity> {
  protected tableName = "test_table_init";
  public initializeTableCallCount = 0;

  protected initializeTable(): void {
    this.initializeTableCallCount++;
    if (config.database.provider === "sqlite") {
      const db = SQLiteConfig.getClient();
      db.exec(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        )
      `);
    }
  }
}

describe("Table Initialization Bug Prevention", () => {
  let repository: TestTableRepository;
  let originalProvider: string;
  let testDb: Database.Database;

  beforeEach(() => {
    originalProvider = config.database.provider;
    config.database.provider = "sqlite";

    testDb = new Database(":memory:");
    vi.spyOn(SQLiteConfig, "getClient").mockReturnValue(testDb);

    repository = new TestTableRepository();
  });

  afterEach(() => {
    config.database.provider = originalProvider as "supabase" | "sqlite";

    try {
      testDb.close();
    } catch (error) {
      // Ignore cleanup errors
    }

    vi.restoreAllMocks();
  });

  it("should NOT call initializeTable during constructor", () => {
    // This test verifies that initializeTable is not called during construction
    // when tableName might still be undefined
    expect(repository.initializeTableCallCount).toBe(0);
  });

  it("should call initializeTable lazily on first database operation", async () => {
    expect(repository.initializeTableCallCount).toBe(0);

    // First database operation should trigger table initialization
    await repository.create({
      name: "Test User",
      email: "test@example.com",
    });

    expect(repository.initializeTableCallCount).toBe(1);
  });

  it("should call initializeTable only once even with multiple operations", async () => {
    expect(repository.initializeTableCallCount).toBe(0);

    // Multiple operations should only initialize once
    await repository.create({ name: "User 1", email: "user1@example.com" });
    expect(repository.initializeTableCallCount).toBe(1);

    await repository.create({ name: "User 2", email: "user2@example.com" });
    expect(repository.initializeTableCallCount).toBe(1);

    await repository.findMany();
    expect(repository.initializeTableCallCount).toBe(1);

    await repository.count();
    expect(repository.initializeTableCallCount).toBe(1);
  });

  it("should have correct tableName when initializeTable is called", async () => {
    // Spy on the actual table creation to verify tableName is correct

    const execSpy = vi.spyOn(testDb, "exec");

    await repository.create({
      name: "Test User",
      email: "test@example.com",
    });

    // Verify that the SQL contains the correct table name, not 'undefined'
    expect(execSpy).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS test_table_init"),
    );
    expect(execSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS undefined"),
    );
  });

  it("should create table with correct name in database", async () => {
    await repository.create({
      name: "Test User",
      email: "test@example.com",
    });

    // Verify the actual table was created with correct name
    const tables = testDb
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='test_table_init'",
      )
      .all();

    expect(tables).toHaveLength(1);
    expect(tables[0]).toEqual({ name: "test_table_init" });
  });

  it("should not create 'undefined' table in database", async () => {
    await repository.create({
      name: "Test User",
      email: "test@example.com",
    });

    // Verify no 'undefined' table was created
    const undefinedTables = testDb
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='undefined'",
      )
      .all();

    expect(undefinedTables).toHaveLength(0);
  });

  it("should work correctly with multiple repository instances", async () => {
    const repo1 = new TestTableRepository();
    const repo2 = new TestTableRepository();

    expect(repo1.initializeTableCallCount).toBe(0);
    expect(repo2.initializeTableCallCount).toBe(0);

    await repo1.create({ name: "User 1", email: "user1@example.com" });
    expect(repo1.initializeTableCallCount).toBe(1);
    expect(repo2.initializeTableCallCount).toBe(0);

    await repo2.create({ name: "User 2", email: "user2@example.com" });
    expect(repo1.initializeTableCallCount).toBe(1);
    expect(repo2.initializeTableCallCount).toBe(1);
  });

  it("should handle all repository methods with lazy initialization", async () => {
    // Test each operation can trigger initialization
    const operationsToTest = ["create", "findMany", "count", "findFirst"];

    for (const opName of operationsToTest) {
      const newRepo = new TestTableRepository();
      expect(newRepo.initializeTableCallCount).toBe(0);

      // Execute the operation on the new repo
      switch (opName) {
        case "create":
          await newRepo.create({
            name: "Test",
            email: `test${Date.now()}@example.com`,
          });
          break;
        case "findMany":
          await newRepo.findMany();
          break;
        case "count":
          await newRepo.count();
          break;
        case "findFirst":
          await newRepo.findFirst();
          break;
      }

      expect(newRepo.initializeTableCallCount).toBe(1);
    }
  });
});

describe("Table Name Validation", () => {
  let originalProvider: string;

  beforeEach(() => {
    originalProvider = config.database.provider;
    config.database.provider = "sqlite";
  });

  afterEach(() => {
    config.database.provider = originalProvider as "supabase" | "sqlite";
    vi.restoreAllMocks();
  });

  it("should throw error if tableName is undefined or empty", async () => {
    class BadRepository extends BaseRepository<ITestEntity> {
      protected tableName = undefined as any; // Simulate the bug

      protected initializeTable(): void {
        if (config.database.provider === "sqlite") {
          const db = SQLiteConfig.getClient();
          db.exec(`CREATE TABLE IF NOT EXISTS ${this.tableName} (id TEXT)`);
        }
      }
    }

    const testDb = new Database(":memory:");
    vi.spyOn(SQLiteConfig, "getClient").mockReturnValue(testDb);

    const badRepo = new BadRepository();

    // This should fail gracefully rather than creating an 'undefined' table
    await expect(
      badRepo.create({ name: "Test", email: "test@example.com" }),
    ).rejects.toThrow();

    testDb.close();
  });
});
