interface IEnvironment {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_KEY: string;
  FRONTEND_URL: string;
  NODE_ENV: "development" | "production" | "test";
  REDIS_URL: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value;
}

export const env: IEnvironment = {
  SUPABASE_URL: getEnvVar("SUPABASE_URL", "https://your_supabase_url_here"),
  SUPABASE_ANON_KEY: getEnvVar(
    "SUPABASE_ANON_KEY",
    "your_supabase_anon_key_here"
  ),
  SUPABASE_SERVICE_KEY: getEnvVar(
    "SUPABASE_SERVICE_KEY",
    "your_supabase_service_key_here"
  ),
  FRONTEND_URL: getEnvVar("FRONTEND_URL", "http://localhost:3000"),
  NODE_ENV: (process.env.NODE_ENV as IEnvironment["NODE_ENV"]) || "development",
  REDIS_URL: getEnvVar("REDIS_URL", "redis://localhost:6379"),
  REDIS_HOST: getEnvVar("REDIS_HOST", "localhost"),
  REDIS_PORT: parseInt(getEnvVar("REDIS_PORT", "6379")),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
};
