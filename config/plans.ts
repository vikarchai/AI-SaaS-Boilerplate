/** Default Stripe Product metadata: `product` = `plan` (override via env on server). */
export const DEFAULT_STRIPE_PLAN_METADATA = {
  key: "product",
  value: "plan",
} as const;

const PAID_ACCESS_STATUSES = new Set(["active", "trialing"]);

type CurrentPlanResolution = {
  key: string;
  displayLabel: string;
};

export function resolveCurrentPlanDisplay(
  row: {
    stripeSubscriptionId: string | null;
    status: string;
    priceId: string | null;
  } | null,
  offers: { priceId: string; label: string }[],
): CurrentPlanResolution {
  if (
    !row?.stripeSubscriptionId ||
    !PAID_ACCESS_STATUSES.has(row.status) ||
    !row.priceId?.trim()
  ) {
    return { key: "free", displayLabel: "Free" };
  }
  const pid = row.priceId.trim();
  const hit = offers.find((o) => o.priceId === pid);
  if (hit) return { key: pid, displayLabel: hit.label };
  return {
    key: "custom",
    displayLabel: "Custom (price not in catalog)",
  };
}
