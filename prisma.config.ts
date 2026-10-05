import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma configuration, replacing the deprecated `package.json#prisma` block.
 *
 * Declaring a config file turns off Prisma's own dotenv loading, so `.env` is
 * loaded here explicitly — otherwise `DATABASE_URL` is missing for every CLI
 * command while the app itself still works, which is a confusing place to land.
 */
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // No .env file: rely on the ambient environment (CI, production).
}

// Migrations connect through DIRECT_URL (see schema.prisma). Without a pooler,
// as in local development, it's simply the same database as DATABASE_URL.
process.env.DIRECT_URL ??= process.env.DATABASE_URL;

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "node --experimental-strip-types --no-warnings prisma/seed.ts",
  },
});
