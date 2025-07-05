import { Get, JsonController } from 'routing-controllers';
import { Service } from 'typedi';
import { HealthService } from '../services/health.service';
import { HealthResponseDto, DatabaseHealthDto } from '../models/dtos/common/health-response.dto';

@JsonController('/health')
@Service()
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Get('/')
  async getHealth(): Promise<HealthResponseDto> {
    return this.healthService.getSystemHealth();
  }

  @Get('/database')
  async getDatabaseHealth(): Promise<DatabaseHealthDto> {
    return this.healthService.getDatabaseHealth();
  }
}