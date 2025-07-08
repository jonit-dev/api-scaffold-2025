import { Container } from "typedi";
import { PrismaClient } from "../../node_modules/.prisma/test-client";

const createTestSchema = async (prisma: PrismaClient): Promise<void> => {
  // Create SQLite schema for tests
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL UNIQUE,
      "first_name" TEXT NOT NULL,
      "last_name" TEXT NOT NULL,
      "password_hash" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'User',
      "status" TEXT NOT NULL DEFAULT 'PendingVerification',
      "phone" TEXT,
      "avatar_url" TEXT,
      "last_login" DATETIME,
      "stripe_customer_id" TEXT,
      "email_unsubscribed" BOOLEAN NOT NULL DEFAULT false,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "deleted_at" DATETIME
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "payments" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "stripe_payment_intent_id" TEXT NOT NULL UNIQUE,
      "user_id" TEXT NOT NULL,
      "stripe_customer_id" TEXT NOT NULL,
      "amount" INTEGER NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'usd',
      "status" TEXT NOT NULL,
      "payment_method" TEXT,
      "description" TEXT,
      "metadata" TEXT,
      "processed_at" DATETIME,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "deleted_at" DATETIME,
      FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "subscriptions" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "stripe_subscription_id" TEXT NOT NULL UNIQUE,
      "user_id" TEXT NOT NULL,
      "stripe_customer_id" TEXT NOT NULL,
      "product_id" TEXT NOT NULL,
      "price_id" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "current_period_start" DATETIME NOT NULL,
      "current_period_end" DATETIME NOT NULL,
      "trial_start" DATETIME,
      "trial_end" DATETIME,
      "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
      "canceled_at" DATETIME,
      "quantity" INTEGER NOT NULL DEFAULT 1,
      "metadata" TEXT,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "deleted_at" DATETIME,
      FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "webhook_events" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "stripe_event_id" TEXT NOT NULL UNIQUE,
      "event_type" TEXT NOT NULL,
      "processed" BOOLEAN NOT NULL DEFAULT false,
      "processed_at" DATETIME,
      "payload" TEXT NOT NULL,
      "processing_error" TEXT,
      "retry_count" INTEGER NOT NULL DEFAULT 0,
      "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "deleted_at" DATETIME
    )
  `);
};

export const initializeTestDatabase = async (): Promise<void> => {
  // Initialize test database connection using in-memory SQLite
  const prisma = new PrismaClient();

  // Ensure database is ready and apply migrations
  try {
    await prisma.$connect();

    // For SQLite in-memory, we need to create the schema manually
    await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON;");

    // Create the test schema
    await createTestSchema(prisma);

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
