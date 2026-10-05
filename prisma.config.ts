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

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "node --experimental-strip-types --no-warnings prisma/seed.ts",
  },
});
