import { Get, JsonController } from "routing-controllers";
import { Service, Container } from "typedi";
import { HealthService } from "../services/health.service";
import {
  IHealthResponseDto,
  IDatabaseHealthDto,
} from "../models/dtos/common/health-response.dto";

interface ISuccessResponse<T> {
  success: true;
  data: T;
  message: string;
  timestamp: string;
}

@JsonController("/health")
@Service()
export class HealthController {
  private healthService: HealthService;

  constructor() {
    this.healthService = Container.get(HealthService);
  }

  @Get("/")
  async getHealth(): Promise<ISuccessResponse<unknown>> {
    const healthData = await this.healthService.getHealth();
    return {
      success: true,
      data: healthData,
      message: "Health check completed",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("/database")
  async getDatabaseHealth(): Promise<ISuccessResponse<IDatabaseHealthDto>> {
    const databaseHealth = await this.healthService.getDatabaseHealth();
    return {
      success: true,
      data: databaseHealth,
      message: "Database health check completed",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("/detailed")
  async getDetailedHealth(): Promise<ISuccessResponse<IHealthResponseDto>> {
    const healthData = await this.healthService.getSystemHealth();
    return {
      success: true,
      data: healthData,
      message: "Detailed health check completed",
      timestamp: new Date().toISOString(),
    };
  }
}
