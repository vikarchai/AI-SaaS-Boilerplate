import { desc, eq } from "drizzle-orm";
import type { Express } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { getAuth } from "../services/auth.js";
import { getDb } from "../db.js";
import { subscriptions } from "../../schema/subscriptions.js";
import { user } from "../../schema/user.js";
import { asyncHandler } from "../middleware/error-handler.js";

export function registerAdminRoutes(app: Express): void {
  app.get(
    "/api/admin/overview",
    asyncHandler(async (req, res) => {
      const auth = getAuth();
      const db = getDb();
      if (!auth || !db) {
        res.status(503).json({ error: "Service unavailable" });
        return;
      }
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (!session?.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const role = (session.user as { role?: string }).role;
      if (role !== "admin") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const rows = await db
        .select({
          userId: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          userCreatedAt: user.createdAt,
          role: user.role,
          stripeCustomerId: user.stripeCustomerId,
          subscriptionId: subscriptions.id,
          stripeStatus: subscriptions.status,
          stripeSubscriptionId: subscriptions.stripeSubscriptionId,
          priceId: subscriptions.priceId,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
        })
        .from(user)
        .leftJoin(subscriptions, eq(user.id, subscriptions.userId))
        .orderBy(desc(user.createdAt));

      res.json({ users: rows });
    }),
  );
}
