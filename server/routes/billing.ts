import type { Express } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { fromNodeHeaders } from "better-auth/node";
import { env, isStripeConfigured } from "../../config/env.js";
import { resolveCurrentPlanDisplay } from "../../config/plans.js";
import { user } from "../../schema/user.js";
import { getAuth } from "../services/auth.js";
import { stripeService } from "../services/stripe.service.js";
import {
  fetchStripePlanOffers,
  getDefaultStripePlanPriceId,
  isAllowedCheckoutPriceId,
} from "../services/stripe-plans.service.js";
import { getDb } from "../db.js";
import { asyncHandler } from "../middleware/error-handler.js";

const checkoutBodySchema = z.object({
  priceId: z.string().min(1).optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

const portalBodySchema = z.object({
  returnUrl: z.string().url().optional(),
});

function appBaseUrl(): string {
  return env.BETTER_AUTH_URL!.replace(/\/$/, "");
}

export function registerBillingRoutes(app: Express): void {
  app.get(
    "/api/billing/status",
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

      const [u] = await db
        .select({ stripeCustomerId: user.stripeCustomerId })
        .from(user)
        .where(eq(user.id, session.user.id))
        .limit(1);

      const offers = await fetchStripePlanOffers();
      const offerLabels = offers.map((o) => ({
        priceId: o.priceId,
        label: o.displayAmount ? `${o.label} (${o.displayAmount})` : o.label,
      }));

      const row = await stripeService.getSubscriptionForUser(db, session.user.id);
      const resolved = resolveCurrentPlanDisplay(
        row
          ? {
              stripeSubscriptionId: row.stripeSubscriptionId,
              status: row.status,
              priceId: row.priceId,
            }
          : null,
        offerLabels,
      );

      const plans = [
        {
          key: "free",
          label: "Free",
          description: "Default until you subscribe via Checkout.",
          priceId: null as string | null,
          isFree: true,
        },
        ...offers.map((o) => ({
          key: o.priceId,
          label: o.displayAmount ? `${o.label} (${o.displayAmount})` : o.label,
          description: o.description || "—",
          priceId: o.priceId,
          isFree: false,
        })),
      ];

      const defaultPriceId = await getDefaultStripePlanPriceId();

      res.json({
        currentPlanKey: resolved.key,
        currentPlanLabel: resolved.displayLabel,
        plans,
        subscription: row
          ? {
              status: row.status,
              priceId: row.priceId,
              currentPeriodEnd: row.currentPeriodEnd,
              hasSubscription: Boolean(row.stripeSubscriptionId),
            }
          : null,
        stripeConfigured: isStripeConfigured(),
        defaultPriceId,
        hasStripeCustomer: Boolean(u?.stripeCustomerId),
      });
    }),
  );

  app.post(
    "/api/billing/checkout",
    asyncHandler(async (req, res) => {
      if (!isStripeConfigured()) {
        res.status(503).json({ error: "Stripe is not configured" });
        return;
      }
      const auth = getAuth();
      const db = getDb();
      if (!auth || !db || !env.BETTER_AUTH_URL) {
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

      const parsed = checkoutBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
        return;
      }

      const fromBody = parsed.data.priceId?.trim();
      const defaultId = await getDefaultStripePlanPriceId();
      const priceId = fromBody || defaultId || undefined;

      if (!priceId) {
        res.status(400).json({
          error: "Missing priceId",
          hint:
            "No recurring prices found. In Stripe, set Product metadata to match your plan filter (default: product=plan) and attach an active recurring Price.",
        });
        return;
      }

      if (fromBody && !(await isAllowedCheckoutPriceId(fromBody))) {
        res.status(400).json({
          error: "Invalid priceId",
          hint: "priceId must be an active recurring price on a plan-tagged Product.",
        });
        return;
      }

      const base = appBaseUrl();
      const successUrl = parsed.data.successUrl ?? `${base}/billing?checkout=success`;
      const cancelUrl = parsed.data.cancelUrl ?? `${base}/billing?checkout=cancel`;

      const out = await stripeService.createCheckoutSession(db, {
        userId: session.user.id,
        email: session.user.email,
        name: session.user.name,
        priceId,
        successUrl,
        cancelUrl,
      });

      if (!out) {
        res.status(500).json({ error: "Could not create Checkout session" });
        return;
      }
      res.json({ url: out.url });
    }),
  );

  app.post(
    "/api/billing/portal",
    asyncHandler(async (req, res) => {
      if (!isStripeConfigured()) {
        res.status(503).json({ error: "Stripe is not configured" });
        return;
      }
      const auth = getAuth();
      const db = getDb();
      if (!auth || !db || !env.BETTER_AUTH_URL) {
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

      const parsed = portalBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
        return;
      }

      const base = appBaseUrl();
      const returnUrl = parsed.data.returnUrl ?? `${base}/billing`;

      const out = await stripeService.createBillingPortalSession(db, {
        userId: session.user.id,
        returnUrl,
      });

      if (!out) {
        res.status(400).json({
          error: "No Stripe customer yet",
          hint: "Open Checkout once so a Customer is created on your user",
        });
        return;
      }
      res.json({ url: out.url });
    }),
  );
}
