import { Service, Inject } from "typedi";
import { SupabaseClient } from "@supabase/supabase-js";
import { checkSupabaseConnection } from "../config/supabase";
import {
  IHealthResponseDto,
  IDatabaseHealthDto,
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

  private async checkDatabaseHealth(): Promise<IServiceStatus> {
    const startTime = Date.now();

    try {
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
        details: "Database connection healthy",
      };
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
}
