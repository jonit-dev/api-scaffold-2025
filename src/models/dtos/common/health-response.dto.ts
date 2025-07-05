export interface ServiceStatusDto {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  message?: string;
}

export interface MemoryUsageDto {
  used: number;
  total: number;
  external: number;
}

export interface CpuUsageDto {
  usage: number;
  loadAverage?: number[];
}

export interface DatabaseHealthDto extends ServiceStatusDto {
  connectionPool?: {
    active: number;
    idle: number;
    total: number;
  };
}

export interface HealthResponseDto {
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