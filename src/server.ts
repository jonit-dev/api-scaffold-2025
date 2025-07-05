import { app } from "./app";
import { config } from "./config/env";

app.listen(config.server.port, () => {
  console.log(`🚀 Server running on port ${config.server.port}`);
  console.log(`📋 Environment: ${config.server.environment}`);
  console.log(`🏥 Health check: http://localhost:${config.server.port}/health`);
});

export default app;
