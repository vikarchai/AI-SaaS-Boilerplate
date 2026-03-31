import express, { type Express, type Request, type Response } from "express";
import Stripe from "stripe";
import { env } from "../../../config/env.js";
import { getDb } from "../../db.js";
import { stripeService } from "../../services/stripe.service.js";

/** Subscription id from subscription invoices (incl. API versions that use `parent.subscription_details`). */
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent;
  if (
    parent?.type === "subscription_details" &&
    parent.subscription_details?.subscription
  ) {
    const s = parent.subscription_details.subscription;
    return typeof s === "string" ? s : s.id;
  }
  const legacy = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };
  if (legacy.subscription) {
    return typeof legacy.subscription === "string"
      ? legacy.subscription
      : legacy.subscription.id;
  }
  return null;
}

/** Snapshot of subscription metadata on the invoice (includes `userId` from Checkout). */
function userIdFromInvoiceParent(invoice: Stripe.Invoice): string | undefined {
  const parent = invoice.parent;
  if (parent?.type !== "subscription_details" || !parent.subscription_details?.metadata) {
    return undefined;
  }
  const uid = parent.subscription_details.metadata.userId;
  return typeof uid === "string" ? uid : undefined;
}

/**
 * Register **before** `express.json()` and Better Auth body parsers.
 * Uses `express.raw` so `constructEvent` receives the untouched body.
 */
export function registerStripeWebhook(app: Express): void {
  const configuredSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
  if (
    configuredSecret &&
    (configuredSecret.startsWith("http://") ||
      configuredSecret.startsWith("https://"))
  ) {
    console.warn(
      "[stripe:webhook] STRIPE_WEBHOOK_SECRET looks like a URL. Use the Signing secret (whsec_…) from Stripe Dashboard or `stripe listen`, not the endpoint URL.",
    );
  }

  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const db = getDb();
      const secret = env.STRIPE_WEBHOOK_SECRET?.trim();
      if (!db || !stripeService.isConfigured() || !secret) {
        res.status(503).json({ error: "Stripe webhook not configured" });
        return;
      }

      const sig = req.headers["stripe-signature"];
      if (typeof sig !== "string") {
        res.status(400).json({ error: "Missing stripe-signature" });
        return;
      }

      let event: Stripe.Event;
      try {
        const stripe = stripeService.getClient()!;
        const raw =
          req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body));
        event = stripe.webhooks.constructEvent(raw, sig, secret);
      } catch (err) {
        console.error("[stripe:webhook] signature verification failed", err);
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      try {
        console.log("[stripe:webhook]", event.type, event.id);

        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            if (session.mode !== "subscription") {
              console.log(
                "[stripe:webhook] checkout.session.completed: skip — mode is %s (need subscription)",
                session.mode ?? "undefined",
              );
              break;
            }
            const subRef = session.subscription;
            const subId =
              typeof subRef === "string" ? subRef : subRef && "id" in subRef ? subRef.id : null;
            if (!subId) {
              console.log(
                "[stripe:webhook] checkout.session.completed: skip — no subscription on session (async payment or test payload?)",
              );
              break;
            }

            const stripe = stripeService.getClient()!;
            const sub = await stripe.subscriptions.retrieve(subId, {
              expand: ["items.data.price"],
            });
            const userIdFromCheckout =
              session.metadata?.userId && typeof session.metadata.userId === "string"
                ? session.metadata.userId
                : undefined;
            const saved = await stripeService.syncSubscriptionFromStripe(
              db,
              sub,
              userIdFromCheckout,
            );
            if (!saved) {
              console.log(
                "[stripe:webhook] checkout: no DB row — need session.metadata.userId (Checkout) or user.stripe_customer_id",
              );
            }
            break;
          }
          case "customer.subscription.created":
          case "customer.subscription.updated": {
            const sub = event.data.object as Stripe.Subscription;
            const saved = await stripeService.syncSubscriptionFromStripe(db, sub);
            if (!saved) {
              console.log(
                `[stripe:webhook] ${event.type}: no DB row — sub.metadata.userId or customer must match app user`,
              );
            }
            break;
          }
          case "customer.subscription.deleted": {
            const sub = event.data.object as Stripe.Subscription;
            await stripeService.clearSubscriptionByStripeId(db, sub.id);
            console.log("[stripe:webhook] subscription cleared", sub.id);
            break;
          }
          /** Newer Stripe flows often deliver this; `checkout.session.completed` may be absent on the endpoint. */
          case "invoice.paid": {
            const invoice = event.data.object as Stripe.Invoice;
            const subId = subscriptionIdFromInvoice(invoice);
            if (!subId) {
              console.log("[stripe:webhook] invoice.paid: skip — not a subscription invoice");
              break;
            }
            const fallbackUserId = userIdFromInvoiceParent(invoice);
            const stripe = stripeService.getClient()!;
            const sub = await stripe.subscriptions.retrieve(subId, {
              expand: ["items.data.price"],
            });
            const saved = await stripeService.syncSubscriptionFromStripe(
              db,
              sub,
              fallbackUserId,
            );
            if (!saved) {
              console.log(
                "[stripe:webhook] invoice.paid: no DB row — check subscription metadata.userId or user.stripe_customer_id",
              );
            }
            break;
          }
          default:
            console.log("[stripe:webhook] no handler for type (ok — not all events touch DB)");
            break;
        }
      } catch (e) {
        console.error("[stripe:webhook] handler error", e);
        res.status(500).json({ error: "Webhook handler failed" });
        return;
      }

      res.json({ received: true });
    },
  );
}
