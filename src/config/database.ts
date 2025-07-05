import { config } from "./app";

export const databaseConfig = {
  url: config.database.url,
  anonKey: config.database.anonKey,
  serviceKey: config.database.serviceKey,
  poolSize: config.database.poolSize,
  connectionTimeout: config.database.connectionTimeout,

  // Connection options
  options: {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "X-Client-Info": "api-scaffold",
      },
    },
  },
};

// Validate database configuration
export function validateDatabaseConfig(): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.database.url) {
    errors.push("SUPABASE_URL is required");
  }

  if (!config.database.anonKey && !config.database.serviceKey) {
    errors.push("Either SUPABASE_ANON_KEY or SUPABASE_SERVICE_KEY is required");
  }

  if (config.database.url && !config.database.url.startsWith("https://")) {
    errors.push("SUPABASE_URL must be a valid HTTPS URL");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Test database connection
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const { supabase } = await import("./supabase");
    const { error } = await supabase.from("health_check").select("1").limit(1);

    // PGRST116 means table doesn't exist, but connection is working
    return !error || error.code === "PGRST116";
  } catch (error) {
    console.error("Database connection test failed:", error);
    return false;
  }
}

export default databaseConfig;
