import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env.js";
import { account } from "../schema/account.js";
import {
  accountRelations,
  sessionRelations,
  subscriptionRelations,
  userRelations,
} from "../schema/relations.js";
import { session } from "../schema/session.js";
import { subscriptions } from "../schema/subscriptions.js";
import { user } from "../schema/user.js";
import { verification } from "../schema/verification.js";

const drizzleSchema = {
  user,
  session,
  account,
  verification,
  subscriptions,
  userRelations,
  sessionRelations,
  accountRelations,
  subscriptionRelations,
};

export type Db = ReturnType<typeof drizzle<typeof drizzleSchema>>;

let client: ReturnType<typeof postgres> | undefined;
let db: Db | undefined;

/** Returns Drizzle instance, or `null` if `DATABASE_URL` is missing (dev-friendly). */
export function getDb(): Db | null {
  const connectionString = env.DATABASE_URL?.trim();
  if (!connectionString) {
    return null;
  }
  if (!db) {
    client = postgres(connectionString, { max: 10 });
    db = drizzle(client, { schema: drizzleSchema });
  }
  return db;
}
