import { Container } from "typedi";
import { app } from "./app";
import { config } from "./config/env";
import { RedisConfig } from "./config/redis";
import { CacheService } from "./services/cache.service";
import { logger } from "./services/logger.service";

async function startServer(): Promise<void> {
  try {
    // Initialize Redis connection at startup
    const redisClient = RedisConfig.getClient();

    // Only connect if not already connected
    if (redisClient.status !== "ready" && redisClient.status !== "connecting") {
      await redisClient.connect();
    }

    // Initialize cache service
    Container.get(CacheService);

    // Start the server
    app.listen(config.server.port, () => {
      logger.info(`🚀 Server running on port ${config.server.port}`);
      logger.info(`📋 Environment: ${config.server.environment}`);
      logger.info(
        `🏥 Health check: http://localhost:${config.server.port}/health`,
      );
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown handling
const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`\n🔄 Shutting down gracefully (${signal})...`);
  try {
    await RedisConfig.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

startServer();

export default app;
