import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { Service } from "typedi";
import { config } from "./env";

export interface ISQLiteConfig {
  path: string;
  enableWal: boolean;
  enableForeignKeys: boolean;
  timeout: number;
}

@Service()
export class SQLiteConfig {
  private static instance: Database.Database;
  private static dbPath: string;

  public static getClient(): Database.Database {
    if (!SQLiteConfig.instance) {
      SQLiteConfig.instance = SQLiteConfig.createClient();
    }
    return SQLiteConfig.instance;
  }

  private static createClient(): Database.Database {
    const dbPath = config.sqlite.path;
    SQLiteConfig.dbPath = dbPath;

    // Ensure directory exists
    const dir = path.dirname(dbPath);
    fs.mkdirSync(dir, { recursive: true });

    const db = new Database(dbPath, {
      verbose: undefined,
      timeout: config.sqlite.timeout,
    });

    // Configure database
    if (config.sqlite.enableWal) {
      db.pragma("journal_mode = WAL");
    }

    if (config.sqlite.enableForeignKeys) {
      db.pragma("foreign_keys = ON");
    }

    // Optimize for performance
    db.pragma("synchronous = NORMAL");
    db.pragma("cache_size = 1000");
    db.pragma("temp_store = memory");

    console.log(`✅ SQLite database connected at: ${dbPath}`);

    return db;
  }

  public static close(): void {
    if (SQLiteConfig.instance) {
      SQLiteConfig.instance.close();
      SQLiteConfig.instance = null as unknown as Database.Database;
    }
  }

  public static reset(): void {
    if (SQLiteConfig.instance) {
      SQLiteConfig.instance.close();
      SQLiteConfig.instance = null as unknown as Database.Database;
    }
  }

  public static getPath(): string {
    return SQLiteConfig.dbPath;
  }
}
