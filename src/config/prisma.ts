import { PrismaClient } from "@prisma/client";
import { config } from "./env";

let prisma: PrismaClient;

declare global {
  var __prisma: PrismaClient | undefined;
}

if (config.server.environment === "production") {
  prisma = new PrismaClient();
} else {
  // In development, use a global variable so the PrismaClient is not recreated
  // on every hot reload, which would exhaust database connections
  // eslint-disable-next-line no-undef
  if (!global.__prisma) {
    // eslint-disable-next-line no-undef
    global.__prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }
  // eslint-disable-next-line no-undef
  prisma = global.__prisma;
}

// Handle graceful shutdown
const gracefulShutdown = async (): Promise<void> => {
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

export { prisma };
export default prisma;
