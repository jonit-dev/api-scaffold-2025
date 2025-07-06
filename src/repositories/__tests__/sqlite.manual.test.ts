import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { BaseRepository } from "@repositories/base.repository";
import { IBaseEntity } from "../../types/database.types";
import { config } from "../../config/env";
import { SQLiteConfig } from "../../config/sqlite";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

interface IUserEntity extends IBaseEntity {
  name: string;
  email: string;
  role?: string;
}

class UserTestRepository extends BaseRepository<IUserEntity> {
  protected tableName = "users_test";

  protected initializeTable(): void {
    if (config.database.provider === "sqlite") {
      const db = SQLiteConfig.getClient();
      db.exec(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          role TEXT DEFAULT 'user',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        )
      `);
    }
  }
}

describe("SQLite Manual Data Persistence Tests", () => {
  let repository: UserTestRepository;
  let testDbPath: string;
  let originalProvider: string;

  beforeAll(() => {
    // Set up test database
    originalProvider = config.database.provider;
    config.database.provider = "sqlite";

    testDbPath = path.join(process.cwd(), "data", "test-manual.sqlite");

    // Ensure data directory exists
    const dataDir = path.dirname(testDbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Remove existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Override SQLite path for this test
    const originalPath = config.sqlite.path;
    config.sqlite.path = testDbPath;

    repository = new UserTestRepository();

    // Restore original path
    config.sqlite.path = originalPath;
  });

  afterAll(() => {
    // Cleanup
    config.database.provider = originalProvider as "supabase" | "sqlite";

    // Close database connection and remove test file
    try {
      const db = SQLiteConfig.getClient();
      db.close();
    } catch (error) {
      // Ignore cleanup errors
    }

    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it("should create and persist data to SQLite file", async () => {
    // Create test users
    const user1 = await repository.create({
      name: "John Doe",
      email: "john@example.com",
      role: "admin",
    });

    const user2 = await repository.create({
      name: "Jane Smith",
      email: "jane@example.com",
    });

    // Verify database file exists
    expect(fs.existsSync(testDbPath)).toBe(true);

    // Verify data was created
    expect(user1.name).toBe("John Doe");
    expect(user1.role).toBe("admin");
    expect(user2.name).toBe("Jane Smith");

    // Query directly from database to verify persistence
    const db = new Database(testDbPath);
    const directQuery = db
      .prepare("SELECT * FROM users_test WHERE deleted_at IS NULL")
      .all();

    expect(directQuery).toHaveLength(2);
    expect(
      directQuery.find((u: any) => u.email === "john@example.com"),
    ).toBeDefined();
    expect(
      directQuery.find((u: any) => u.email === "jane@example.com"),
    ).toBeDefined();

    db.close();
  });

  it("should perform CRUD operations and maintain data integrity", async () => {
    // Create a user
    const user = await repository.create({
      name: "Test User",
      email: "test@example.com",
      role: "tester",
    });

    // Read the user
    const foundUser = await repository.findById(user.id);
    expect(foundUser).toEqual(user);

    // Update the user
    const updatedUser = await repository.update(user.id, {
      name: "Updated Test User",
      role: "senior-tester",
    });

    expect(updatedUser.name).toBe("Updated Test User");
    expect(updatedUser.role).toBe("senior-tester");
    expect(updatedUser.email).toBe("test@example.com");

    // Verify update persistence
    const db = new Database(testDbPath);
    const directUser = db
      .prepare("SELECT * FROM users_test WHERE id = ?")
      .get(user.id) as any;
    expect(directUser.name).toBe("Updated Test User");
    expect(directUser.role).toBe("senior-tester");
    db.close();

    // Soft delete
    await repository.softDelete(user.id);
    const deletedUser = await repository.findById(user.id);
    expect(deletedUser).toBeNull();

    // Verify soft delete in database
    const db2 = new Database(testDbPath);
    const softDeletedUser = db2
      .prepare("SELECT * FROM users_test WHERE id = ?")
      .get(user.id) as any;
    expect(softDeletedUser.deleted_at).toBeTruthy();
    db2.close();
  });

  it("should handle complex queries and pagination", async () => {
    // Create multiple users
    const users = [];
    for (let i = 1; i <= 10; i++) {
      const user = await repository.create({
        name: `User ${i}`,
        email: `user${i}@example.com`,
        role: i % 2 === 0 ? "admin" : "user",
      });
      users.push(user);
    }

    // Test pagination
    const page1 = await repository.findWithPagination({
      pagination: { page: 1, limit: 3 },
    });

    expect(page1.data).toHaveLength(3);
    expect(page1.pagination.total).toBeGreaterThanOrEqual(10);
    expect(page1.pagination.hasNext).toBe(true);

    // Test filtering
    const admins = await repository.findMany({
      filters: { role: "admin" },
    });

    expect(admins.length).toBeGreaterThan(0);
    expect(admins.every((u) => u.role === "admin")).toBe(true);

    // Test counting
    const totalCount = await repository.count();
    const adminCount = await repository.count({ role: "admin" });

    expect(totalCount).toBeGreaterThanOrEqual(10);
    expect(adminCount).toBeLessThan(totalCount);
  });

  it("should maintain database consistency across transactions", async () => {
    const initialCount = await repository.count();

    // Create user
    const user = await repository.create({
      name: "Transaction Test",
      email: "transaction@example.com",
    });

    // Verify count increased
    expect(await repository.count()).toBe(initialCount + 1);

    // Update user
    await repository.update(user.id, { name: "Updated Transaction Test" });

    // Count should remain the same
    expect(await repository.count()).toBe(initialCount + 1);

    // Delete user
    await repository.hardDelete(user.id);

    // Count should decrease
    expect(await repository.count()).toBe(initialCount);
  });

  it("should handle database errors gracefully", async () => {
    // Test duplicate email constraint
    await repository.create({
      name: "Unique Test",
      email: "unique@example.com",
    });

    await expect(
      repository.create({
        name: "Duplicate Test",
        email: "unique@example.com",
      }),
    ).rejects.toThrow();

    // Test update non-existent record
    await expect(
      repository.update("non-existent-id", { name: "Should Fail" }),
    ).rejects.toThrow();

    // Test delete non-existent record
    await expect(repository.hardDelete("non-existent-id")).rejects.toThrow();
  });

  it("should verify database file structure and schema", () => {
    const db = new Database(testDbPath);

    // Check table exists
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users_test'",
      )
      .all();
    expect(tables).toHaveLength(1);

    // Check table schema
    const schema = db.prepare("PRAGMA table_info(users_test)").all() as any[];
    const columnNames = schema.map((col) => col.name);

    expect(columnNames).toContain("id");
    expect(columnNames).toContain("name");
    expect(columnNames).toContain("email");
    expect(columnNames).toContain("role");
    expect(columnNames).toContain("created_at");
    expect(columnNames).toContain("updated_at");
    expect(columnNames).toContain("deleted_at");

    // Check unique constraint on email
    const indexes = db.prepare("PRAGMA index_list(users_test)").all() as any[];
    const hasUniqueEmailIndex = indexes.some((idx) => idx.unique === 1);
    expect(hasUniqueEmailIndex).toBe(true);

    db.close();
  });
});
