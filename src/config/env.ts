import dotenv from "dotenv";

// Load environment variables
dotenv.config({ quiet: true });

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
    provider: getEnvVar("DATABASE_PROVIDER", "postgresql") as
      | "postgresql"
      | "supabase",
    url: getEnvVar(
      "DATABASE_URL",
      "postgresql://api_user:api_password@localhost:5432/api_scaffold",
    ),
    host: getEnvVar("DATABASE_HOST", "localhost"),
    port: parseInt(getEnvVar("DATABASE_PORT", "5432"), 10),
    name: getEnvVar("DATABASE_NAME", "api_scaffold"),
    username: getEnvVar("DATABASE_USERNAME", "api_user"),
    password: getEnvVar("DATABASE_PASSWORD", "api_password"),
    poolSize: parseInt(process.env.DB_POOL_SIZE || "20", 10),
    connectionTimeout: parseInt(
      process.env.DB_CONNECTION_TIMEOUT || "30000",
      10,
    ),
  },
  auth: {
    jwtSecret: getEnvVar("JWT_SECRET"),
    bcryptRounds: getEnvVar("BCRYPT_ROUNDS", "10"),
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === "true",
  },
  cache: {
    provider: (process.env.CACHE_PROVIDER || "redis") as "redis" | "local",
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || "1000", 10),
    ttl: parseInt(process.env.CACHE_TTL || "300", 10),
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
    level: process.env.LOG_LEVEL || "info",
    format: process.env.LOG_FORMAT || "combined",
    enableConsole: process.env.ENABLE_CONSOLE_LOGS !== "false",
    enableFile: process.env.ENABLE_FILE_LOGS === "true",
    dir: process.env.LOG_DIR || "logs",
    maxSize: process.env.LOG_MAX_SIZE || "20m",
    maxFiles: parseInt(process.env.LOG_MAX_FILES || "14", 10),
    enableRotation: process.env.ENABLE_LOG_ROTATION !== "false",
  },
  redis: {
    url: getEnvVar("REDIS_URL", "redis://localhost:6379"),
    host: getEnvVar("REDIS_HOST", "localhost"),
    port: parseInt(getEnvVar("REDIS_PORT", "6379")),
    password: process.env.REDIS_PASSWORD,
  },
  stripe: {
    publishableKey: getEnvVar("STRIPE_PUBLISHABLE_KEY"),
    secretKey: getEnvVar("STRIPE_SECRET_KEY"),
    webhookSecret: getEnvVar("STRIPE_WEBHOOK_SECRET"),
    apiVersion: (process.env.STRIPE_API_VERSION ||
      "2025-06-30.basil") as "2025-06-30.basil",
  },
  payment: {
    defaultCurrency: process.env.DEFAULT_CURRENCY || "usd",
    maxPaymentAmount: parseInt(process.env.MAX_PAYMENT_AMOUNT || "100000", 10),
    minPaymentAmount: parseInt(process.env.MIN_PAYMENT_AMOUNT || "50", 10),
    autoCapture: process.env.AUTO_CAPTURE_PAYMENTS === "true",
  },
  subscription: {
    defaultTrialDays: parseInt(process.env.DEFAULT_TRIAL_DAYS || "14", 10),
    allowMultipleSubscriptions:
      process.env.ALLOW_MULTIPLE_SUBSCRIPTIONS === "true",
    prorationBehavior: process.env.PRORATION_BEHAVIOR || "create_prorations",
    gracePeriodDays: parseInt(process.env.GRACE_PERIOD_DAYS || "3", 10),
    maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || "3", 10),
  },
  webhook: {
    stripeEndpointSecret: getEnvVar("STRIPE_WEBHOOK_SECRET"),
    maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || "3", 10),
    retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY || "1000", 10),
  },
  middleware: {
    enableSecurity: process.env.ENABLE_SECURITY_MIDDLEWARE !== "false",
    enableCompression: process.env.ENABLE_COMPRESSION_MIDDLEWARE !== "false",
    enableMorganLogging: process.env.ENABLE_MORGAN_LOGGING !== "false",
  },
  email: {
    resendApiKey: getEnvVar("RESEND_API"),
    fromAddress: getEnvVar(
      "RESEND_EMAIL_FROM_ADDRESS",
      "onboarding@resend.dev",
    ),
    fromName: getEnvVar("RESEND_EMAIL_FROM_NAME", "Your App"),
  },
  env: {
    supabaseUrl: getEnvVar("SUPABASE_URL"),
    supabaseAnonKey: getEnvVar("SUPABASE_ANON_KEY"),
    supabaseServiceKey: getEnvVar("SUPABASE_SERVICE_KEY"),
    frontendUrl: getEnvVar("FRONTEND_URL", "http://localhost:3000"),
    nodeEnv:
      (process.env.NODE_ENV as "development" | "production" | "test") ||
      "development",
  },
};

// Environment validation
const requiredEnvVars = [
  "NODE_ENV",
  "JWT_SECRET",
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_KEY",
];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  // Use console.warn here since logger service depends on this config
  console.warn(
    `⚠️  Missing required environment variables: ${missingEnvVars.join(", ")}`,
  );
}
