import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "../lib/auth-client.js";

type Row = {
  userId: string;
  email: string;
  name: string;
  emailVerified: boolean;
  userCreatedAt: string;
  role: string | null;
  subscriptionId: string | null;
  stripeStatus: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  priceId: string | null;
  currentPeriodEnd: string | null;
};

export function AdminPage() {
  const session = authClient.useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/overview", { credentials: "include" });
      const data = (await res.json()) as { users?: Row[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setRows(data.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session.data?.user) void load();
  }, [load, session.data?.user]);

  if (session.isPending) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-14">
        <p className="text-zinc-500">Loading…</p>
      </div>
    );
  }

  if (!session.data?.user) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-14">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Admin</h1>
        <p className="mt-4 text-zinc-400">
          Sign in first, then return here if your account has the{" "}
          <code className="text-zinc-300">admin</code> role.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-14">
      <h1 className="text-2xl font-semibold tracking-tight text-white">Admin</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Users and subscription status. Requires{" "}
        <code className="text-zinc-400">role = admin</code> on the account.
      </p>

      <div className="mt-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/"
            className="text-sm text-emerald-400/90 hover:text-emerald-300"
          >
            ← Back home
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Refresh
          </button>
        </div>

        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-zinc-500">Loading users…</p>
        ) : (
          <div className="w-full overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-950/80 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Verified</th>
                  <th className="px-3 py-2 font-medium">Subscription</th>
                  <th className="px-3 py-2 font-medium">Period end</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                      No users yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.userId} className="hover:bg-zinc-900/40">
                      <td className="px-3 py-2">
                        <div className="font-medium text-zinc-100">{r.email}</div>
                        <div className="text-xs text-zinc-500">{r.name}</div>
                      </td>
                      <td className="px-3 py-2 text-zinc-300">{r.role ?? "—"}</td>
                      <td className="px-3 py-2 text-zinc-400">
                        {r.emailVerified ? "yes" : "no"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-zinc-200">{r.stripeStatus ?? "—"}</div>
                        <div className="font-mono text-xs text-zinc-600">
                          {r.stripeSubscriptionId ?? r.stripeCustomerId ?? "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-500">
                        {r.currentPeriodEnd
                          ? new Date(r.currentPeriodEnd).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
