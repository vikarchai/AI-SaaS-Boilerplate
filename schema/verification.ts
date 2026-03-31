import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Magic-link / email verification tokens (Better Auth). */
export const verification = pgTable("verification",{
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export type VerificationSelect = typeof verification.$inferSelect;
export type VerificationInsert = typeof verification.$inferInsert;
