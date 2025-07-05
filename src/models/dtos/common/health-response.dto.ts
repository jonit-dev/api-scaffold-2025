export interface IServiceStatusDto {
  status: "healthy" | "unhealthy" | "degraded";
  responseTime?: number;
  message?: string;
  setupInstructions?: string;
}

export interface IMemoryUsageDto {
  used: number;
  total: number;
  external: number;
}

export interface ICpuUsageDto {
  usage: number;
  loadAverage?: number[];
}

export interface IDatabaseHealthDto extends IServiceStatusDto {
  connectionPool?: {
    active: number;
    idle: number;
    total: number;
  };
}

export interface IHealthResponseDto {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: Date;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: IServiceStatusDto;
    cache?: IServiceStatusDto;
  };
  system: {
    memory: IMemoryUsageDto;
    cpu?: ICpuUsageDto;
  };
}
