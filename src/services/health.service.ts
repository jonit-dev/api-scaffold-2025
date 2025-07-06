import { SupabaseClient } from "@supabase/supabase-js";
import { Inject, Service } from "typedi";
import { config } from "../config/env";
import { SQLiteConfig } from "../config/sqlite";
import { checkSupabaseConnection } from "../config/supabase";
import {
  IDatabaseHealthDto,
  IHealthResponseDto,
} from "../models/dtos/common/health-response.dto";

interface IHealthResponse {
  status: "ok" | "warning" | "error";
  timestamp: Date;
  services: {
    database: IServiceStatus;
  };
}

interface IServiceStatus {
  status: "ok" | "warning" | "error";
  response_time: number;
  details: string;
}

@Service()
export class HealthService {
  constructor(@Inject("supabase") private supabase?: SupabaseClient) {}

  async getHealth(): Promise<IHealthResponse> {
    const databaseHealth = await this.checkDatabaseHealth();

    // Determine overall health status based on database only
    const overallStatus = databaseHealth.status;

    return {
      status: overallStatus,
      timestamp: new Date(),
      services: {
        database: databaseHealth,
      },
    };
  }

  async getSystemHealth(): Promise<IHealthResponseDto> {
    const dbHealth = await this.getDatabaseHealth();
    const memoryUsage = process.memoryUsage();

    return {
      status: dbHealth.status === "healthy" ? "healthy" : "degraded",
      timestamp: new Date(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      services: {
        database: dbHealth,
      },
      system: {
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          external: memoryUsage.external,
        },
      },
    };
  }

  async getDatabaseHealth(): Promise<IDatabaseHealthDto> {
    const startTime = Date.now();

    try {
      if (config.database.provider === "sqlite") {
        return await this.checkSQLiteHealth(startTime);
      } else {
        return await this.checkSupabaseHealth(startTime);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: "unhealthy",
        responseTime,
        message:
          error instanceof Error ? error.message : "Database connection failed",
        setupInstructions: this.getDatabaseSetupInstructions(),
      };
    }
  }

  private async checkSQLiteHealth(
    startTime: number,
  ): Promise<IDatabaseHealthDto> {
    try {
      const db = SQLiteConfig.getClient();

      // Simple health check - try to execute a basic query
      const result = db.prepare("SELECT 1 as health_check").get();
      const responseTime = Date.now() - startTime;

      if (result) {
        return {
          status: "healthy",
          responseTime,
          message: "SQLite database connection successful",
        };
      } else {
        return {
          status: "unhealthy",
          responseTime,
          message: "SQLite database query failed",
          setupInstructions: this.getDatabaseSetupInstructions(),
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: "unhealthy",
        responseTime,
        message:
          error instanceof Error ? error.message : "SQLite connection failed",
        setupInstructions: this.getDatabaseSetupInstructions(),
      };
    }
  }

  private async checkSupabaseHealth(
    startTime: number,
  ): Promise<IDatabaseHealthDto> {
    const isConnected = await checkSupabaseConnection();
    const responseTime = Date.now() - startTime;

    return {
      status: isConnected ? "healthy" : "unhealthy",
      responseTime,
      message: isConnected
        ? "Supabase database connection successful"
        : "Supabase database connection failed",
      setupInstructions: isConnected
        ? undefined
        : this.getDatabaseSetupInstructions(),
    };
  }

  private getDatabaseSetupInstructions(): string {
    if (config.database.provider === "sqlite") {
      return (
        "SQLite is configured automatically. Check file permissions and disk space at: " +
        config.sqlite.path
      );
    } else {
      return "To setup Supabase: 1. Create a Supabase project at https://supabase.com 2. Copy your project URL and anon key 3. Set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file 4. Ensure your database is accessible and tables are created";
    }
  }

  private async checkDatabaseHealth(): Promise<IServiceStatus> {
    const startTime = Date.now();

    try {
      if (config.database.provider === "sqlite") {
        return await this.checkSQLiteHealthStatus(startTime);
      } else {
        return await this.checkSupabaseHealthStatus(startTime);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: "error",
        response_time: responseTime,
        details:
          error instanceof Error ? error.message : "Database connection failed",
      };
    }
  }

  private async checkSQLiteHealthStatus(
    startTime: number,
  ): Promise<IServiceStatus> {
    try {
      const db = SQLiteConfig.getClient();
      const result = db.prepare("SELECT 1 as health_check").get();
      const responseTime = Date.now() - startTime;

      if (result) {
        return {
          status: responseTime > 1000 ? "warning" : "ok",
          response_time: responseTime,
          details:
            responseTime > 1000
              ? `SQLite responding slow: ${responseTime}ms`
              : "SQLite database connection healthy",
        };
      } else {
        return {
          status: "error",
          response_time: responseTime,
          details: "SQLite database query failed",
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: "error",
        response_time: responseTime,
        details:
          error instanceof Error ? error.message : "SQLite connection failed",
      };
    }
  }

  private async checkSupabaseHealthStatus(
    startTime: number,
  ): Promise<IServiceStatus> {
    if (!this.supabase) {
      return {
        status: "error",
        response_time: 1,
        details: "Database error: Supabase not configured",
      };
    }

    const { error } = await this.supabase
      .from("health_check")
      .select("1 as result")
      .single();

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        status: "error",
        response_time: responseTime,
        details: `Database error: ${error.message}`,
      };
    }

    if (responseTime > 1000) {
      return {
        status: "warning",
        response_time: responseTime,
        details: `Database responding slow: ${responseTime}ms`,
      };
    }

    return {
      status: "ok",
      response_time: responseTime,
      details: "Supabase database connection healthy",
    };
  }
}
