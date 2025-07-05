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
    memory: IServiceStatus;
    cpu: IServiceStatus;
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
    const [databaseHealth, memoryHealth, cpuHealth] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkMemoryHealth(),
      this.checkCpuHealth(),
    ]);

    // Determine overall health status
    const services = [databaseHealth, memoryHealth, cpuHealth];
    const hasError = services.some((s) => s.status === "error");
    const hasWarning = services.some((s) => s.status === "warning");

    const overallStatus = hasError ? "error" : hasWarning ? "warning" : "ok";

    return {
      status: overallStatus,
      timestamp: new Date(),
      services: {
        database: databaseHealth,
        memory: memoryHealth,
        cpu: cpuHealth,
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
        throw new Error("Supabase client not available");
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

  private async checkMemoryHealth(): Promise<IServiceStatus> {
    const startTime = Date.now();

    try {
      const memoryUsage = process.memoryUsage();
      const memoryMB = memoryUsage.rss / 1024 / 1024;
      const responseTime = Date.now() - startTime;

      if (memoryMB > 150) {
        return {
          status: "warning",
          response_time: responseTime,
          details: `High memory usage: ${memoryMB.toFixed(2)} MB`,
        };
      }

      return {
        status: "ok",
        response_time: responseTime,
        details: `Memory usage: ${memoryMB.toFixed(2)} MB`,
      };
    } catch {
      const responseTime = Date.now() - startTime;
      return {
        status: "error",
        response_time: responseTime,
        details: "Memory check failed",
      };
    }
  }

  private async checkCpuHealth(): Promise<IServiceStatus> {
    const startTime = Date.now();

    try {
      const cpuUsage = process.cpuUsage();
      const responseTime = Date.now() - startTime;

      return {
        status: "ok",
        response_time: responseTime,
        details: `CPU usage: ${((cpuUsage.user + cpuUsage.system) / 1000000).toFixed(2)}s`,
      };
    } catch {
      const responseTime = Date.now() - startTime;
      return {
        status: "error",
        response_time: responseTime,
        details: "CPU check failed",
      };
    }
  }
}
