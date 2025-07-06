import { app } from "./app";
import { config } from "./config/env";
import { logger } from "./services/logger.service";

app.listen(config.server.port, () => {
  logger.info(`🚀 Server running on port ${config.server.port}`);
  logger.info(`📋 Environment: ${config.server.environment}`);
  logger.info(`🏥 Health check: http://localhost:${config.server.port}/health`);
});

export default app;
