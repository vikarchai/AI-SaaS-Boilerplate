import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./user.ts";

/**
 * One row per app user: Stripe subscription mirror (synced via webhooks).
 * `status` follows Stripe subscription status strings (e.g. active, canceled).
 */
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  status: text("status").notNull().default("none"),
  priceId: text("price_id"),
  currentPeriodEnd: timestamp("current_period_end", {withTimezone: true, mode: "date"}),
});

export type SubscriptionSelect = typeof subscriptions.$inferSelect;
export type SubscriptionInsert = typeof subscriptions.$inferInsert;
