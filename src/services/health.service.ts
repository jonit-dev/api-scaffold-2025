import { Service } from "typedi";
import { checkSupabaseConnection } from "../config/supabase";
import {
  IHealthResponseDto,
  IServiceStatusDto,
  IDatabaseHealthDto,
} from "../models/dtos/common/health-response.dto";

@Service()
export class HealthService {
  async getSystemHealth(): Promise<IHealthResponseDto> {
    const dbHealth = await this.checkDatabaseHealth();
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
      const isConnected = await checkSupabaseConnection();
      const responseTime = Date.now() - startTime;

      return {
        status: isConnected ? "healthy" : "unhealthy",
        responseTime,
        message: isConnected
          ? "Database connection successful"
          : "Database connection failed",
        setupInstructions: isConnected
          ? undefined
          : "To setup Supabase: 1. Create a Supabase project at https://supabase.com 2. Copy your project URL and anon key 3. Set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file 4. Ensure your database is accessible and tables are created",
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: "unhealthy",
        responseTime,
        message:
          error instanceof Error ? error.message : "Database connection failed",
        setupInstructions:
          "To setup Supabase: 1. Create a Supabase project at https://supabase.com 2. Copy your project URL and anon key 3. Set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file 4. Ensure your database is accessible and tables are created",
      };
    }
  }

  private async checkDatabaseHealth(): Promise<IServiceStatusDto> {
    const startTime = Date.now();

    try {
      const isConnected = await checkSupabaseConnection();
      const responseTime = Date.now() - startTime;

      return {
        status: isConnected ? "healthy" : "unhealthy",
        responseTime,
        message: isConnected
          ? "Database connection successful"
          : "Database connection failed",
        setupInstructions: isConnected
          ? undefined
          : "To setup Supabase: 1. Create a Supabase project at https://supabase.com 2. Copy your project URL and anon key 3. Set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file 4. Ensure your database is accessible and tables are created",
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: "unhealthy",
        responseTime,
        message:
          error instanceof Error ? error.message : "Database connection failed",
        setupInstructions:
          "To setup Supabase: 1. Create a Supabase project at https://supabase.com 2. Copy your project URL and anon key 3. Set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file 4. Ensure your database is accessible and tables are created",
      };
    }
  }
}
