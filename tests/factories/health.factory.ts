import {
  IHealthResponseDto,
  IServiceStatusDto,
} from "@/models/dtos/common/health-response.dto";

export class HealthFactory {
  static createHealthResponse(
    overrides: Partial<IHealthResponseDto> = {},
  ): IHealthResponseDto {
    return {
      status: "healthy",
      timestamp: new Date("2023-01-01T00:00:00.000Z"),
      uptime: 12345,
      version: "1.0.0",
      environment: "test",
      services: {
        database: this.createServiceStatus({ status: "healthy" }),
      },
      system: {
        memory: {
          used: 100,
          total: 1000,
          external: 50,
        },
      },
      ...overrides,
    };
  }

  static createServiceStatus(
    overrides: Partial<IServiceStatusDto> = {},
  ): IServiceStatusDto {
    return {
      status: "healthy",
      responseTime: 15,
      message: "Service is running normally",
      ...overrides,
    };
  }

  static createUnhealthyResponse(
    overrides: Partial<IHealthResponseDto> = {},
  ): IHealthResponseDto {
    return this.createHealthResponse({
      status: "unhealthy",
      services: {
        database: this.createServiceStatus({
          status: "unhealthy",
          responseTime: 5000,
          message: "Database connection failed",
        }),
      },
      ...overrides,
    });
  }

  static createPartiallyHealthyResponse(
    overrides: Partial<IHealthResponseDto> = {},
  ): IHealthResponseDto {
    return this.createHealthResponse({
      status: "degraded",
      services: {
        database: this.createServiceStatus({ status: "healthy" }),
      },
      system: {
        memory: {
          used: 800,
          total: 1000,
          external: 100,
        },
      },
      ...overrides,
    });
  }
}
