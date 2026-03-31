import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Better Auth `user` row (camelCase fields → snake_case columns). */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
  role: text("role").notNull().default("user"),
  stripeCustomerId: text("stripe_customer_id").unique(),
});

/** Row read from the database. */
export type UserSelect = typeof user.$inferSelect;
/** Row accepted on insert (optional fields omitted where DB defaults apply). */
export type UserInsert = typeof user.$inferInsert;
