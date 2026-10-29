import { PrismaClient } from "@prisma/client";

/**
 * A single Prisma Client instance shared across hot reloads in development
 * and across serverless function invocations in production. Connects
 * through the pooled Supabase connection string (DATABASE_URL); migrations
 * run against DIRECT_URL instead, see prisma/schema.prisma.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
