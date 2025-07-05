import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthService } from '@/services/health.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { HealthFactory } from '../../factories/health.factory';
import { TestHelpers } from '../../utils/test.helpers';

describe('HealthService', () => {
  let healthService: HealthService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(() => {
    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    TestHelpers.setupMockSupabaseClient(mockSupabaseClient);
    healthService = new HealthService(mockSupabaseClient);
  });

  describe('getHealth', () => {
    it('should return healthy status when all services are operational', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { result: 1 },
        error: null,
      });

      const result = await healthService.getHealth();

      expect(result).toEqual(expect.objectContaining({
        status: 'ok',
        timestamp: expect.any(Date),
        services: expect.objectContaining({
          database: expect.objectContaining({
            status: 'ok',
            response_time: expect.any(Number),
            details: expect.any(String),
          }),
          memory: expect.objectContaining({
            status: 'ok',
            response_time: expect.any(Number),
            details: expect.any(String),
          }),
          cpu: expect.objectContaining({
            status: 'ok',
            response_time: expect.any(Number),
            details: expect.any(String),
          }),
        }),
      }));
    });

    it('should return error status when database is unreachable', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' },
      });

      const result = await healthService.getHealth();

      expect(result).toEqual(expect.objectContaining({
        status: 'error',
        services: expect.objectContaining({
          database: expect.objectContaining({
            status: 'error',
            details: expect.stringContaining('Connection failed'),
          }),
        }),
      }));
    });

    it('should return warning status when database is slow', async () => {
      mockQueryBuilder.single.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              data: { result: 1 },
              error: null,
            });
          }, 1500);
        });
      });

      const result = await healthService.getHealth();

      expect(result).toEqual(expect.objectContaining({
        status: 'warning',
        services: expect.objectContaining({
          database: expect.objectContaining({
            status: 'warning',
            response_time: expect.any(Number),
            details: expect.stringContaining('slow'),
          }),
        }),
      }));
    });

    it('should handle memory usage checks', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { result: 1 },
        error: null,
      });

      const mockMemoryUsage = vi.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 50 * 1024 * 1024, // 50MB
        heapTotal: 30 * 1024 * 1024, // 30MB
        heapUsed: 20 * 1024 * 1024, // 20MB
        external: 5 * 1024 * 1024, // 5MB
        arrayBuffers: 1 * 1024 * 1024, // 1MB
      });

      const result = await healthService.getHealth();

      expect(result.services.memory.status).toBe('ok');
      expect(result.services.memory.details).toContain('Memory usage: 50.00 MB');

      mockMemoryUsage.mockRestore();
    });

    it('should return warning when memory usage is high', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { result: 1 },
        error: null,
      });

      const mockMemoryUsage = vi.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 200 * 1024 * 1024, // 200MB - high memory usage
        heapTotal: 150 * 1024 * 1024,
        heapUsed: 120 * 1024 * 1024,
        external: 30 * 1024 * 1024,
        arrayBuffers: 10 * 1024 * 1024,
      });

      const result = await healthService.getHealth();

      expect(result.services.memory.status).toBe('warning');
      expect(result.services.memory.details).toContain('High memory usage');

      mockMemoryUsage.mockRestore();
    });

    it('should handle CPU usage checks', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { result: 1 },
        error: null,
      });

      const mockCpuUsage = vi.spyOn(process, 'cpuUsage').mockReturnValue({
        user: 1000000, // 1 second
        system: 500000, // 0.5 seconds
      });

      const result = await healthService.getHealth();

      expect(result.services.cpu.status).toBe('ok');
      expect(result.services.cpu.details).toContain('CPU usage');

      mockCpuUsage.mockRestore();
    });

    it('should handle service timeout gracefully', async () => {
      mockQueryBuilder.single.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100);
        });
      });

      const result = await healthService.getHealth();

      expect(result.status).toBe('error');
      expect(result.services.database.status).toBe('error');
      expect(result.services.database.details).toContain('Timeout');
    });

    it('should measure response times accurately', async () => {
      mockQueryBuilder.single.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              data: { result: 1 },
              error: null,
            });
          }, 100);
        });
      });

      const result = await healthService.getHealth();

      expect(result.services.database.response_time).toBeGreaterThan(90);
      expect(result.services.database.response_time).toBeLessThan(200);
    });
  });
});