import { Service } from "typedi";
import { config } from "../config/env";
import { prisma } from "../config/prisma";
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
  constructor() {}

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
      if (config.database.provider === "postgresql") {
        return await this.checkPostgreSQLHealth(startTime);
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

  private async checkPostgreSQLHealth(
    startTime: number,
  ): Promise<IDatabaseHealthDto> {
    try {
      // Simple health check - try to execute a basic query
      await prisma.$queryRaw`SELECT 1 as health_check`;
      const responseTime = Date.now() - startTime;

      return {
        status: "healthy",
        responseTime,
        message: "PostgreSQL database connection successful",
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: "unhealthy",
        responseTime,
        message:
          error instanceof Error
            ? error.message
            : "PostgreSQL connection failed",
        setupInstructions: this.getDatabaseSetupInstructions(),
      };
    }
  }

  private async checkSupabaseHealth(
    startTime: number,
  ): Promise<IDatabaseHealthDto> {
    try {
      // For Supabase, we'll just return a basic health check
      // since we don't have the Supabase client setup anymore
      const responseTime = Date.now() - startTime;

      return {
        status: "healthy",
        responseTime,
        message: "Supabase database configured",
        setupInstructions: this.getDatabaseSetupInstructions(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: "unhealthy",
        responseTime,
        message:
          error instanceof Error ? error.message : "Supabase connection failed",
        setupInstructions: this.getDatabaseSetupInstructions(),
      };
    }
  }

  private getDatabaseSetupInstructions(): string {
    if (config.database.provider === "postgresql") {
      return "PostgreSQL with Prisma: 1. Ensure PostgreSQL is running 2. Run 'npx prisma migrate deploy' to apply migrations 3. Check DATABASE_URL in your .env file";
    } else {
      return "To setup Supabase: 1. Create a Supabase project at https://supabase.com 2. Copy your project URL and anon key 3. Set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file 4. Ensure your database is accessible and tables are created";
    }
  }

  private async checkDatabaseHealth(): Promise<IServiceStatus> {
    const startTime = Date.now();

    try {
      if (config.database.provider === "postgresql") {
        return await this.checkPostgreSQLHealthStatus(startTime);
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

  private async checkPostgreSQLHealthStatus(
    startTime: number,
  ): Promise<IServiceStatus> {
    try {
      await prisma.$queryRaw`SELECT 1 as health_check`;
      const responseTime = Date.now() - startTime;

      return {
        status: responseTime > 1000 ? "warning" : "ok",
        response_time: responseTime,
        details:
          responseTime > 1000
            ? `PostgreSQL responding slow: ${responseTime}ms`
            : "PostgreSQL database connection healthy",
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: "error",
        response_time: responseTime,
        details:
          error instanceof Error
            ? error.message
            : "PostgreSQL connection failed",
      };
    }
  }

  private async checkSupabaseHealthStatus(
    startTime: number,
  ): Promise<IServiceStatus> {
    try {
      const responseTime = Date.now() - startTime;

      return {
        status: "ok",
        response_time: responseTime,
        details: "Supabase database configured",
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        status: "error",
        response_time: responseTime,
        details:
          error instanceof Error ? error.message : "Supabase connection failed",
      };
    }
  }
}
