import "server-only";
import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * Next's dev server re-evaluates modules on every edit, so without the global
 * cache each hot reload would open a fresh connection pool until Postgres
 * refused new connections.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
