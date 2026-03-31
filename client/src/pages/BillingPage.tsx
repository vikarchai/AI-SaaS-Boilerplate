import { useCallback, useEffect, useState } from "react";
import { authClient } from "../lib/auth-client.js";

type PlanCatalogEntry = {
  key: string;
  label: string;
  description: string;
  priceId: string | null;
  isFree: boolean;
};

type BillingStatus = {
  currentPlanKey: string;
  currentPlanLabel?: string;
  plans: PlanCatalogEntry[];
  subscription: {
    status: string;
    priceId: string | null;
    currentPeriodEnd: string | null;
    hasSubscription: boolean;
  } | null;
  stripeConfigured: boolean;
  defaultPriceId: string | null;
  hasStripeCustomer: boolean;
};

export function BillingPage() {
  const session = authClient.useSession();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setMsg(null);
    const res = await fetch("/api/billing/status", { credentials: "include" });
    const data = (await res.json()) as BillingStatus & { error?: string };
    if (!res.ok) {
      setMsg(data.error ?? `HTTP ${res.status}`);
      setStatus(null);
      return;
    }
    setStatus(data);
  }, []);

  useEffect(() => {
    if (!session.data?.user) return;
    void load();
    // Webhook may lag a second or two after Stripe redirects back here.
    const q = new URLSearchParams(window.location.search);
    if (q.get("checkout") !== "success") return;
    const t1 = window.setTimeout(() => void load(), 2000);
    const t2 = window.setTimeout(() => void load(), 5000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [load, session.data?.user]);

  async function startCheckout(body: { priceId?: string } = {}) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { url?: string; error?: string; hint?: string };
      if (!res.ok) {
        throw new Error(
          [data.error, data.hint].filter(Boolean).join(" — ") || `HTTP ${res.status}`,
        );
      }
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { url?: string; error?: string; hint?: string };
      if (!res.ok) {
        throw new Error(
          [data.error, data.hint].filter(Boolean).join(" — ") || `HTTP ${res.status}`,
        );
      }
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Portal failed");
    } finally {
      setBusy(false);
    }
  }

  if (session.isPending) {
    return <p className="text-sm text-zinc-500">Loading session…</p>;
  }

  if (!session.data?.user) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-14">
        <div className="space-y-2">
          <p className="text-sm font-medium tracking-wide text-emerald-400/90">Billing</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Plans</h1>
        </div>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 shadow-xl shadow-black/20 backdrop-blur-sm">
          <p className="text-sm leading-relaxed text-zinc-400">
            Sign in first to manage billing.
          </p>
          <div className="mt-4">
            <a
              href="/sign-in"
              className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Sign in
            </a>
          </div>
        </section>
      </div>
    );
  }

  const current = status?.currentPlanKey;
  const currentLabel = status?.currentPlanLabel;
  const anyPaidReady = status?.plans.some((p) => !p.isFree && p.priceId);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-14">
      <div className="space-y-2">
        <p className="text-sm font-medium tracking-wide text-emerald-400/90">Billing</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Plans</h1>
        <p className="text-sm leading-relaxed text-zinc-500">
          <strong className="text-zinc-400">Free</strong> is the default until Checkout completes.
          Paid plans are loaded from Stripe: set Product metadata (default{" "}
          <code className="text-zinc-400">product=plan</code>) and attach active recurring prices.
          Webhooks keep the <code className="text-zinc-400">subscriptions</code> row in sync.
        </p>
      </div>

      {!status ? (
        <p className="text-sm text-zinc-500">Loading billing status…</p>
      ) : (
        <>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-sm text-zinc-300">
            <span className="text-zinc-500">Your plan:</span>{" "}
            <span className="font-medium text-emerald-400/90">
              {currentLabel ??
                (current === "custom"
                  ? "Custom (price not in catalog)"
                  : (current ?? "—"))}
            </span>
            {status.stripeConfigured ? null : (
              <span className="ml-2 text-amber-400">(Stripe not configured)</span>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {status.plans.map((p) => {
              const isCurrent = current === p.key;
              const canSubscribe =
                !p.isFree &&
                Boolean(p.priceId) &&
                status.stripeConfigured &&
                !isCurrent;

              return (
                <div
                  key={p.key}
                  className={`flex flex-col rounded-2xl border p-5 shadow-lg shadow-black/10 ${
                    isCurrent
                      ? "border-emerald-600/50 bg-emerald-950/20"
                      : "border-zinc-800 bg-zinc-900/40"
                  }`}
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {p.isFree ? "Default" : "Paid"}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-white">{p.label}</h2>
                  <p className="mt-2 flex-1 text-sm text-zinc-500">{p.description}</p>
                  {p.priceId ? (
                    <p className="mt-3 font-mono text-xs text-zinc-600 break-all">{p.priceId}</p>
                  ) : !p.isFree ? (
                    <p className="mt-3 text-xs text-amber-500">Missing recurring price in Stripe</p>
                  ) : null}

                  <div className="mt-4">
                    {p.isFree ? (
                      <span className="text-sm text-zinc-400">
                        {isCurrent ? "Current plan" : "Included by default"}
                      </span>
                    ) : isCurrent ? (
                      <span className="text-sm text-emerald-400/90">Current plan</span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy || !canSubscribe}
                        onClick={() => void startCheckout({ priceId: p.priceId! })}
                        className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busy ? "…" : "Subscribe"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 shadow-xl shadow-black/20 backdrop-blur-sm space-y-4">
            <h2 className="text-sm font-medium text-zinc-300">Stripe subscription row</h2>
            {status.subscription ? (
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Status</dt>
                  <dd className="font-mono text-zinc-200">{status.subscription.status}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Price id</dt>
                  <dd className="font-mono text-zinc-400">
                    {status.subscription.priceId ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Period end</dt>
                  <dd className="text-zinc-400">
                    {status.subscription.currentPeriodEnd
                      ? new Date(status.subscription.currentPeriodEnd).toLocaleString()
                      : "—"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-zinc-500">No subscription row yet (normal for Free).</p>
            )}

            <div className="flex flex-wrap gap-3 border-t border-zinc-800 pt-4">
              <button
                type="button"
                disabled={busy || !status.stripeConfigured || !anyPaidReady}
                onClick={() => void startCheckout({})}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Default checkout
              </button>
              <button
                type="button"
                disabled={busy || !status.stripeConfigured || !status.hasStripeCustomer}
                onClick={() => void openPortal()}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Customer portal
              </button>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800/80"
              >
                Refresh
              </button>
            </div>

            {msg ? (
              <p className="text-sm text-red-400" role="alert">
                {msg}
              </p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
