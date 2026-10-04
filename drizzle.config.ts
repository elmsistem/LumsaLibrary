import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/modules/**/infrastructure/database/schema/**/*.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/lumsa_library",
  },
  verbose: true,
  strict: true,
});
