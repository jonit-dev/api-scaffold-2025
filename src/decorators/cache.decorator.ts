import "reflect-metadata";

export interface ICacheConfig {
  ttl?: number;
  key?: string;
  keyGenerator?: (req: { query?: Record<string, unknown> }) => string;
  condition?: (req: { query?: Record<string, unknown> }) => boolean;
  prefix?: string;
}

export const CACHE_METADATA_KEY = Symbol("cache");

/**
 * Cache decorator for caching route responses
 */
export function Cache(config: ICacheConfig = {}): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol | undefined,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const defaultConfig: ICacheConfig = {
      ttl: 300, // 5 minutes
      prefix: "route:",
      condition: () => true,
      ...config,
    };

    Reflect.defineMetadata(
      CACHE_METADATA_KEY,
      defaultConfig,
      target,
      propertyKey!
    );
    return descriptor;
  };
}
