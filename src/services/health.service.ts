import { Service } from 'typedi';
import { getSupabaseClient, checkSupabaseConnection } from '../config/supabase';
import { HealthResponseDto, ServiceStatusDto, DatabaseHealthDto } from '../models/dtos/common/health-response.dto';

@Service()
export class HealthService {
  private supabase = getSupabaseClient();

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

  async getDatabaseHealth(): Promise<DatabaseHealthDto> {
    const startTime = Date.now();
    
    try {
      const isConnected = await checkSupabaseConnection();
      const responseTime = Date.now() - startTime;
      
      return {
        status: isConnected ? 'healthy' : 'unhealthy',
        responseTime,
        message: isConnected ? 'Database connection successful' : 'Database connection failed'
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: 'unhealthy',
        responseTime,
        message: error instanceof Error ? error.message : 'Database connection failed'
      };
    }
  }

  private async checkDatabaseHealth(): Promise<ServiceStatusDto> {
    const startTime = Date.now();
    
    try {
      const isConnected = await checkSupabaseConnection();
      const responseTime = Date.now() - startTime;
      
      return {
        status: isConnected ? 'healthy' : 'unhealthy',
        responseTime,
        message: isConnected ? 'Database connection successful' : 'Database connection failed'
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: 'unhealthy',
        responseTime,
        message: error instanceof Error ? error.message : 'Database connection failed'
      };
    }
  }
}