import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit loads this file with CommonJS; keep `process.env` only so generation
 * works without ESM `.js` path resolution.
 */
export default defineConfig({
  schema: "./schema",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
