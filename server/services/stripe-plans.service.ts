import Stripe from "stripe";
import { env, isStripeConfigured } from "../../config/env.js";
import { DEFAULT_STRIPE_PLAN_METADATA } from "../../config/plans.js";

const CACHE_TTL_MS = 60_000;

export type StripePlanOffer = {
  /** Use as React key and Checkout `priceId` */
  key: string;
  priceId: string;
  productId: string;
  label: string;
  description: string;
  /** e.g. `$12.00/month` */
  displayAmount: string | null;
  currency: string;
  interval: string | null;
};

let cache: { fetchedAt: number; plans: StripePlanOffer[] } | null = null;

function client(): Stripe | null {
  if (!isStripeConfigured()) return null;
  return new Stripe(env.STRIPE_SECRET_KEY!, { typescript: true });
}

function metadataFilter(): { key: string; value: string } {
  return {
    key:
      env.STRIPE_PLAN_METADATA_KEY?.trim() ||
      DEFAULT_STRIPE_PLAN_METADATA.key,
    value:
      env.STRIPE_PLAN_METADATA_VALUE?.trim() ||
      DEFAULT_STRIPE_PLAN_METADATA.value,
  };
}

function productIsPlan(
  metadata: Stripe.Metadata | null,
  filter: { key: string; value: string },
): boolean {
  if (!metadata) return false;
  return metadata[filter.key] === filter.value;
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}

/**
 * Lists recurring Prices for active Products whose metadata matches the plan filter.
 * Results are cached ~60s.
 */
export async function fetchStripePlanOffers(): Promise<StripePlanOffer[]> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.plans;
  }

  const stripe = client();
  if (!stripe) {
    cache = { fetchedAt: now, plans: [] };
    return [];
  }

  const filter = metadataFilter();
  const offers: StripePlanOffer[] = [];

  let startingAfter: string | undefined;
  for (;;) {
    const page = await stripe.products.list({
      active: true,
      limit: 100,
      starting_after: startingAfter,
    });

    for (const product of page.data) {
      if (!productIsPlan(product.metadata, filter)) continue;

      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
        limit: 50,
      });

      for (const price of prices.data) {
        if (price.type !== "recurring" || !price.recurring) continue;
        const unit = price.unit_amount;
        const currency = price.currency;
        const interval = price.recurring.interval ?? null;
        const displayAmount =
          unit != null
            ? `${formatMoney(unit, currency)}/${interval ?? "period"}`
            : null;

        offers.push({
          key: price.id,
          priceId: price.id,
          productId: product.id,
          label: product.name?.trim() || product.id,
          description: (product.description ?? "").trim(),
          displayAmount,
          currency,
          interval,
        });
      }
    }

    if (!page.has_more) break;
    const last = page.data[page.data.length - 1]?.id;
    if (!last) break;
    startingAfter = last;
  }

  offers.sort((a, b) => a.priceId.localeCompare(b.priceId));

  cache = { fetchedAt: now, plans: offers };
  return offers;
}

export async function getDefaultStripePlanPriceId(): Promise<string | null> {
  const plans = await fetchStripePlanOffers();
  return plans[0]?.priceId ?? null;
}

/** Returns true if `priceId` is a recurring price on a plan-tagged product. */
export async function isAllowedCheckoutPriceId(
  priceId: string,
): Promise<boolean> {
  const plans = await fetchStripePlanOffers();
  return plans.some((p) => p.priceId === priceId);
}

export function invalidateStripePlansCache(): void {
  cache = null;
}
