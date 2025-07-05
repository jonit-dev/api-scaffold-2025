import { Get, JsonController } from "routing-controllers";
import { Service, Container } from "typedi";
import { HealthService } from "../services/health.service";
import {
  IHealthResponseDto,
  IDatabaseHealthDto,
} from "../models/dtos/common/health-response.dto";
import { createSuccessResponse, IApiResponse } from "../utils/response.utils";

@JsonController("/health")
@Service()
export class HealthController {
  private healthService: HealthService;

  constructor() {
    this.healthService = Container.get(HealthService);
  }

  @Get("/")
  async getHealth(): Promise<IApiResponse<unknown>> {
    const healthData = await this.healthService.getHealth();
    return createSuccessResponse(healthData, "Health check completed");
  }

  @Get("/database")
  async getDatabaseHealth(): Promise<IApiResponse<IDatabaseHealthDto>> {
    const databaseHealth = await this.healthService.getDatabaseHealth();
    return createSuccessResponse(
      databaseHealth,
      "Database health check completed",
    );
  }

  @Get("/detailed")
  async getDetailedHealth(): Promise<IApiResponse<IHealthResponseDto>> {
    const healthData = await this.healthService.getSystemHealth();
    return createSuccessResponse(healthData, "Detailed health check completed");
  }
}
