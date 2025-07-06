import { config } from "./env";

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

export default databaseConfig;
