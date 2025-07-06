import dotenv from "dotenv";

// Load environment variables
dotenv.config();

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value;
}

export const config = {
  server: {
    port: parseInt(process.env.PORT || "3000", 10),
    environment: process.env.NODE_ENV || "development",
  },
  database: {
    url: getEnvVar("SUPABASE_URL", "https://your_supabase_url_here"),
    anonKey: getEnvVar("SUPABASE_ANON_KEY", "your_supabase_anon_key_here"),
    serviceKey: getEnvVar(
      "SUPABASE_SERVICE_KEY",
      "your_supabase_service_key_here",
    ),
    poolSize: parseInt(process.env.DB_POOL_SIZE || "20", 10),
    connectionTimeout: parseInt(
      process.env.DB_CONNECTION_TIMEOUT || "30000",
      10,
    ),
  },
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
    ],
    credentials: true,
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || "combined",
  },
  redis: {
    url: getEnvVar("REDIS_URL", "redis://localhost:6379"),
    host: getEnvVar("REDIS_HOST", "localhost"),
    port: parseInt(getEnvVar("REDIS_PORT", "6379")),
    password: process.env.REDIS_PASSWORD,
  },
  env: {
    supabaseUrl: getEnvVar("SUPABASE_URL", "https://your_supabase_url_here"),
    supabaseAnonKey: getEnvVar(
      "SUPABASE_ANON_KEY",
      "your_supabase_anon_key_here",
    ),
    supabaseServiceKey: getEnvVar(
      "SUPABASE_SERVICE_KEY",
      "your_supabase_service_key_here",
    ),
    frontendUrl: getEnvVar("FRONTEND_URL", "http://localhost:3000"),
    nodeEnv:
      (process.env.NODE_ENV as "development" | "production" | "test") ||
      "development",
  },
};

// Environment validation
const requiredEnvVars = ["NODE_ENV"];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.warn(
    `⚠️  Missing optional environment variables: ${missingEnvVars.join(", ")}`,
  );
}
