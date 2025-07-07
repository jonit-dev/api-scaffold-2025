import { config } from "./env";

export const databaseConfig = {
  url: config.database.url,
  host: config.database.host,
  port: config.database.port,
  name: config.database.name,
  username: config.database.username,
  password: config.database.password,
  poolSize: config.database.poolSize,
  connectionTimeout: config.database.connectionTimeout,
  provider: config.database.provider,
};

export default databaseConfig;
