import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Health = {
  ok: boolean;
  env: string;
  database?: boolean;
  auth?: boolean;
  googleOAuth?: boolean;
  stripe?: boolean;
  stripeSubscriptionDefaultPrice?: boolean;
  llm?: boolean;
};

export function HomePage() {
  const [health, setHealth] = useState<Health | null>(null);

  const refresh = useCallback(async () => {
    const h = await fetch("/api/health").then((r) => r.json() as Promise<Health>);
    setHealth(h);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-14">
      <header className="space-y-3">
        <p className="text-sm font-medium tracking-wide text-emerald-400/90">
          Express · Vite · Postgres
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          App template
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          Auth (Better Auth), Stripe subscriptions, admin, streaming LLM chat.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link
            to="/sign-in"
            className="font-medium text-emerald-400/90 hover:text-emerald-300"
          >
            Sign in →
          </Link>
          <Link
            to="/chat"
            className="font-medium text-emerald-400/90 hover:text-emerald-300"
          >
            Chat →
          </Link>
          <Link
            to="/billing"
            className="font-medium text-emerald-400/90 hover:text-emerald-300"
          >
            Billing →
          </Link>
          <Link
            to="/admin"
            className="font-medium text-emerald-400/90 hover:text-emerald-300"
          >
            Admin →
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 shadow-xl shadow-black/20 backdrop-blur-sm">
        <h2 className="text-lg font-medium text-zinc-100">API health</h2>
        <p className="mt-2 font-mono text-sm text-zinc-400">
          {health ? (
            <>
              <span className="text-emerald-400">ok={String(health.ok)}</span>
              <span className="text-zinc-600"> · </span>
              <span>env={health.env}</span>
              {health.database !== undefined ? (
                <>
                  <span className="text-zinc-600"> · </span>
                  <span>db={String(health.database)}</span>
                </>
              ) : null}
              {health.auth !== undefined ? (
                <>
                  <span className="text-zinc-600"> · </span>
                  <span>auth={String(health.auth)}</span>
                </>
              ) : null}
              {health.googleOAuth !== undefined ? (
                <>
                  <span className="text-zinc-600"> · </span>
                  <span>google={String(health.googleOAuth)}</span>
                </>
              ) : null}
              {health.stripe !== undefined ? (
                <>
                  <span className="text-zinc-600"> · </span>
                  <span>stripe={String(health.stripe)}</span>
                </>
              ) : null}
              {health.stripeSubscriptionDefaultPrice !== undefined ? (
                <>
                  <span className="text-zinc-600"> · </span>
                  <span>
                    stripePrice=
                    {String(health.stripeSubscriptionDefaultPrice)}
                  </span>
                </>
              ) : null}
              {health.llm !== undefined ? (
                <>
                  <span className="text-zinc-600"> · </span>
                  <span>llm={String(health.llm)}</span>
                </>
              ) : null}
            </>
          ) : (
            "Loading…"
          )}
        </p>
      </section>
    </div>
  );
}
