import { Container } from "typedi";
import { PrismaClient } from "@prisma/client";
import { config } from "../../src/config/env";

export const initializeTestDatabase = async (): Promise<void> => {
  // Initialize test database connection
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: config.database.url,
      },
    },
  });

  // Clean up database before tests
  await cleanupDatabase(prisma);

  // Register Prisma client in container for tests
  Container.set("prisma", prisma);
};

export const cleanupDatabase = async (prisma: PrismaClient): Promise<void> => {
  // Clean up test data in reverse dependency order
  await prisma.webhookEvent.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.user.deleteMany();
};

export const closeTestDatabase = async (): Promise<void> => {
  const prisma = Container.get("prisma") as PrismaClient;
  if (prisma) {
    await prisma.$disconnect();
  }
};
