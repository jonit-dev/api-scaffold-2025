export enum DatabaseProvider {
  SUPABASE = "supabase",
  SQLITE = "sqlite",
}

export enum CacheProvider {
  REDIS = "redis",
  LOCAL = "local",
}

export interface IDatabaseConfig {
  provider: DatabaseProvider;
  supabase?: {
    url: string;
    anonKey: string;
    serviceKey: string;
    poolSize: number;
    connectionTimeout: number;
  };
  sqlite?: {
    path: string;
    enableWal: boolean;
    enableForeignKeys: boolean;
    timeout: number;
  };
}

export interface ICacheConfig {
  provider: CacheProvider;
  redis?: {
    url: string;
    host: string;
    port: number;
    password?: string;
  };
  local?: {
    maxSize: number;
    ttl: number;
  };
}
