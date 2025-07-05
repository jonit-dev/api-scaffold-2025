# TASK-004: Health Check Controller and Basic API Structure

## Epic
Core API Features

## Story Points
2

## Priority
High

## Description
Create a health check controller to verify API functionality and establish the basic controller pattern for the application.

## Acceptance Criteria

### ✅ Health Check Controller
- [ ] Create `src/controllers/health.controller.ts`
- [ ] Implement basic health check endpoint (`GET /api/health`)
- [ ] Add system status information (uptime, memory, etc.)
- [ ] Include database connection health check
- [ ] Add service dependencies status
- [ ] Return structured health response

### ✅ Response DTOs
- [ ] Create `src/models/dtos/common/health-response.dto.ts`
- [ ] Define health check response structure
- [ ] Include system information fields
- [ ] Add service status indicators
- [ ] Implement proper typing for health data

### ✅ Health Service
- [ ] Create `src/services/health.service.ts`
- [ ] Implement system health checks
- [ ] Add database connectivity check
- [ ] Include memory and CPU usage information
- [ ] Add uptime calculation
- [ ] Implement service dependency checks

### ✅ Basic Error Handling
- [ ] Test controller error handling
- [ ] Verify error response format
- [ ] Ensure proper HTTP status codes
- [ ] Test error logging functionality

## Technical Requirements

### Health Controller Structure
```typescript
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
```

### Health Response DTO
```typescript
export class HealthResponseDto {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceStatusDto;
    cache?: ServiceStatusDto;
  };
  system: {
    memory: MemoryUsageDto;
    cpu?: CpuUsageDto;
  };
}
```

### Health Service Implementation
```typescript
@Service()
export class HealthService {
  constructor(
    @Inject() private supabase: SupabaseClient
  ) {}

  async getSystemHealth(): Promise<HealthResponseDto> {
    const dbHealth = await this.checkDatabaseHealth();
    const memoryUsage = process.memoryUsage();
    
    return {
      status: dbHealth.status === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: dbHealth
      },
      system: {
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          external: memoryUsage.external
        }
      }
    };
  }

  private async checkDatabaseHealth(): Promise<ServiceStatusDto> {
    try {
      const { data, error } = await this.supabase
        .from('health_check')
        .select('1')
        .limit(1);
      
      return {
        status: error ? 'unhealthy' : 'healthy',
        responseTime: Date.now(), // Measure actual response time
        message: error?.message || 'Database connection successful'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Database connection failed'
      };
    }
  }
}
```

## Definition of Done
- [ ] Health check endpoint responds with 200 status
- [ ] Health response includes all required fields
- [ ] Database health check works properly
- [ ] System information is accurate
- [ ] Error handling works for unhealthy states
- [ ] Response format is consistent
- [ ] Health service is properly injected
- [ ] All DTOs are properly typed

## Testing Strategy
- [ ] Test health endpoint returns correct structure
- [ ] Verify database health check accuracy
- [ ] Test error handling when database is down
- [ ] Verify system metrics are reasonable
- [ ] Test response time measurement
- [ ] Check all fields are populated correctly

## Dependencies
- TASK-003: Supabase Integration and Database Configuration

## Notes
- Keep health checks lightweight and fast
- Don't expose sensitive system information
- Consider adding more service health checks as the application grows
- Ensure health checks don't significantly impact performance