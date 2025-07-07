import { Container } from "typedi";
import { PrismaClient } from "@prisma/client";

export const initializeTestDatabase = async (): Promise<void> => {
  // Initialize test database connection using test schema
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || "file:./test.db",
      },
    },
  });

  // Ensure database is ready and apply migrations
  try {
    await prisma.$connect();
    
    // Clean up database before tests
    await cleanupDatabase(prisma);
  } catch (error) {
    console.warn("Database initialization warning:", error);
  }

  // Register Prisma client in container for tests
  Container.set("prisma", prisma);
};

export const cleanupDatabase = async (prisma: PrismaClient): Promise<void> => {
  // Clean up test data in reverse dependency order
  // Note: Some tests might not use all tables, so we catch errors silently
  try {
    await prisma.webhookEvent.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.user.deleteMany();
  } catch (error) {
    // Silently ignore cleanup errors - this is normal for isolated tests
  }
};

export const closeTestDatabase = async (): Promise<void> => {
  const prisma = Container.get("prisma") as PrismaClient;
  if (prisma) {
    await prisma.$disconnect();
  }
};
