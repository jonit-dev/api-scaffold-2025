import { Get, JsonController } from "routing-controllers";
import { Service } from "typedi";
import { HealthService } from "../services/health.service";
import {
  IHealthResponseDto,
  IDatabaseHealthDto,
} from "../models/dtos/common/health-response.dto";

@JsonController("/health")
@Service()
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Get("/")
  async getHealth(): Promise<IHealthResponseDto> {
    return this.healthService.getSystemHealth();
  }

  @Get("/database")
  async getDatabaseHealth(): Promise<IDatabaseHealthDto> {
    return this.healthService.getDatabaseHealth();
  }
}
