import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["server/index.ts"],
  outDir: "dist/server",
  format: ["esm"],
  platform: "node",
  target: "node24",
  clean: true,
  sourcemap: true,
  bundle: true,
  splitting: false,
  external: [
    "vite",
    "better-auth",
    "@better-auth/drizzle-adapter",
    "stripe",
    "openai",
    "@anthropic-ai/sdk",
    "drizzle-orm",
    "postgres",
  ],
});
