import "dotenv/config";
import { z } from "zod";

function emptyToUndefined(val: unknown): unknown {
  if (val === undefined || val === null) return undefined;
  if (typeof val === "string" && val.trim() === "") return undefined;
  return val;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.preprocess((val) => {
    if (val === undefined || val === "") return 3000;
    const n = Number(val);
    return Number.isFinite(n) ? n : val;
  }, z.number().int().positive().max(65535)),
  DATABASE_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().optional(),
  ),
  SERVE_CLIENT: z.preprocess((val) => {
    if (val === undefined || val === "") return true;
    const s = String(val).toLowerCase().trim();
    return !(s === "false" || s === "0");
  }, z.boolean()),

  BETTER_AUTH_SECRET: z.preprocess(emptyToUndefined, z.string().min(16).optional()),
  BETTER_AUTH_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().optional(),
  ),
  GOOGLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  GOOGLE_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),

  STRIPE_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  STRIPE_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  /**
   * Which Product metadata marks a catalog plan (default key `product`, value `plan`).
   * Products with this pair get their recurring Prices listed on `/billing`.
   */
  STRIPE_PLAN_METADATA_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  STRIPE_PLAN_METADATA_VALUE: z.preprocess(emptyToUndefined, z.string().optional()),

  OPENAI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  ANTHROPIC_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:");
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

/** Validated process env; load `dotenv` and fail fast on invalid values. */
export const env = loadEnv();

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY?.trim());
}

export function isLlmConfigured(): boolean {
  return Boolean(env.OPENAI_API_KEY?.trim() || env.ANTHROPIC_API_KEY?.trim());
}

export function isAuthConfigured(): boolean {
  return Boolean(
    env.DATABASE_URL?.trim() &&
      env.BETTER_AUTH_SECRET?.trim() &&
      env.BETTER_AUTH_URL?.trim(),
  );
}

export function isDatabaseConfigured(): boolean {
  return Boolean(env.DATABASE_URL?.trim());
}
