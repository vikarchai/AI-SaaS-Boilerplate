import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { env, isStripeConfigured } from "../../config/env.js";
import { subscriptions } from "../../schema/subscriptions.js";
import { user } from "../../schema/user.js";
import type { Db } from "../db.js";

function stripeClient(): Stripe | null {
  if (!isStripeConfigured()) return null;
  return new Stripe(env.STRIPE_SECRET_KEY!, { typescript: true });
}

function withCheckoutSessionPlaceholder(successUrl: string): string {
  if (successUrl.includes("{CHECKOUT_SESSION_ID}")) return successUrl;
  const sep = successUrl.includes("?") ? "&" : "?";
  return `${successUrl}${sep}session_id={CHECKOUT_SESSION_ID}`;
}

export const stripeService = {
  isConfigured(): boolean {
    return isStripeConfigured();
  },

  getClient(): Stripe | null {
    return stripeClient();
  },

  async getSubscriptionForUser(db: Db, userId: string) {
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
    return row ?? null;
  },

  /**
   * Returns existing Stripe Customer id from `user.stripe_customer_id`, or creates one and persists it.
   */
  async ensureStripeCustomerForUser(
    db: Db,
    params: { userId: string; email: string; name: string | null },
  ): Promise<string | null> {
    const stripe = stripeClient();
    if (!stripe) return null;

    const [existing] = await db
      .select({ stripeCustomerId: user.stripeCustomerId })
      .from(user)
      .where(eq(user.id, params.userId))
      .limit(1);

    if (existing?.stripeCustomerId) return existing.stripeCustomerId;

    const customer = await stripe.customers.create({
      email: params.email,
      name: params.name ?? undefined,
      metadata: { userId: params.userId },
    });

    await db
      .update(user)
      .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
      .where(eq(user.id, params.userId));

    return customer.id;
  },

  /**
   * Stripe Checkout (`subscription` mode) for a given recurring Price id.
   */
  async createCheckoutSession(
    db: Db,
    params: {
      userId: string;
      email: string;
      name: string | null;
      priceId: string;
      successUrl: string;
      cancelUrl: string;
    },
  ): Promise<{ url: string } | null> {
    const stripe = stripeClient();
    if (!stripe) return null;

    const customerId = await this.ensureStripeCustomerForUser(db, {
      userId: params.userId,
      email: params.email,
      name: params.name,
    });
    if (!customerId) return null;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: withCheckoutSessionPlaceholder(params.successUrl),
      cancel_url: params.cancelUrl,
      metadata: { userId: params.userId },
      subscription_data: {
        metadata: { userId: params.userId },
      },
    });

    if (!session.url) return null;
    return { url: session.url };
  },

  /**
   * Stripe Customer Portal (configure in Dashboard → Billing → Customer portal).
   */
  async createBillingPortalSession(
    db: Db,
    params: { userId: string; returnUrl: string },
  ): Promise<{ url: string } | null> {
    const stripe = stripeClient();
    if (!stripe) return null;

    const [row] = await db
      .select({ stripeCustomerId: user.stripeCustomerId })
      .from(user)
      .where(eq(user.id, params.userId))
      .limit(1);

    if (!row?.stripeCustomerId) return null;

    const portal = await stripe.billingPortal.sessions.create({
      customer: row.stripeCustomerId,
      return_url: params.returnUrl,
    });
    return { url: portal.url };
  },

  /**
   * Upsert the user's subscription row from a Stripe Subscription object (Stripe-first).
   */
  /** Returns false if nothing was written (e.g. could not resolve app user). */
  async syncSubscriptionFromStripe(
    db: Db,
    sub: Stripe.Subscription,
    fallbackUserId?: string,
  ): Promise<boolean> {
    const stripe = stripeClient();
    if (!stripe) return false;

    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const firstItem = sub.items.data[0];
    const rawPrice = firstItem?.price;
    const priceId =
      typeof rawPrice === "string"
        ? rawPrice
        : rawPrice && typeof rawPrice === "object" && "id" in rawPrice
          ? rawPrice.id
          : null;
    /** Stripe API: period bounds are on each subscription item. */
    const periodEndUnix = firstItem?.current_period_end ?? null;

    const userId =
      fallbackUserId ??
      (typeof sub.metadata?.userId === "string" ? sub.metadata.userId : null) ??
      (await resolveUserIdByStripeCustomerId(db, customerId));

    if (!userId) {
      console.warn(
        "[stripe] subscription sync: no userId for subscription",
        sub.id,
        "customer",
        customerId,
      );
      return false;
    }

    const row = {
      userId,
      stripeSubscriptionId: sub.id,
      status: sub.status,
      priceId,
      currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
    };

    await db
      .insert(subscriptions)
      .values(row)
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: {
          stripeSubscriptionId: row.stripeSubscriptionId,
          status: row.status,
          priceId: row.priceId,
          currentPeriodEnd: row.currentPeriodEnd,
        },
      });
    console.log("[stripe] subscriptions row upserted", { userId, subscriptionId: sub.id });
    return true;
  },

  async clearSubscriptionByStripeId(db: Db, stripeSubscriptionId: string): Promise<void> {
    await db
      .update(subscriptions)
      .set({
        status: "canceled",
        stripeSubscriptionId: null,
        priceId: null,
        currentPeriodEnd: null,
      })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
  },
};

async function resolveUserIdByStripeCustomerId(
  db: Db,
  customerId: string,
): Promise<string | null> {
  const [fromUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.stripeCustomerId, customerId))
    .limit(1);
  if (fromUser) return fromUser.id;

  const stripe = stripeClient();
  if (!stripe) return null;
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted || !("metadata" in customer)) return null;
  const meta = customer.metadata?.userId;
  return typeof meta === "string" ? meta : null;
}
