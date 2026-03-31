import { relations } from "drizzle-orm";
import { account } from "./account.ts";
import { session } from "./session.ts";
import { subscriptions } from "./subscriptions.ts";
import { user } from "./user.ts";

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  user: one(user, { fields: [subscriptions.userId], references: [user.id] }),
}));
