import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { authClient } from "../lib/auth-client.js";

export function AuthPanel() {
  const session = authClient.useSession();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    void fetch("/api/health")
      .then((r) => r.json() as Promise<{ googleOAuth?: boolean }>)
      .then((h) => setGoogleReady(Boolean(h.googleOAuth)))
      .catch(() => setGoogleReady(false));
  }, []);

  async function onMagicLink(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const result = await authClient.signIn.magicLink({
        email,
        // Relative path — avoids INVALID_CALLBACK_URL when BETTER_AUTH_URL host differs slightly.
        callbackURL: "/",
      });
      if (result.error) {
        console.error("[magic-link] API error", result.error);
        throw new Error(result.error.message ?? "Magic link failed");
      }
      setMsg(
        "Magic link URL is printed in the server terminal (no email is sent). Copy it and open in this browser.",
      );
      setEmail("");
    } catch (err) {
      console.error("[magic-link] request failed", err);
      setMsg(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    setMsg(null);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  if (session.isPending) {
    return <p className="text-sm text-zinc-500">Loading session…</p>;
  }

  if (session.data?.user) {
    const u = session.data.user as {
      id: string;
      email: string;
      name: string;
      role?: string;
    };
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-300">
          Signed in as <span className="font-medium text-white">{u.email}</span>
          {u.role === "admin" ? (
            <span className="ml-2 rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">
              admin
            </span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => void authClient.signOut()}
          className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        disabled={busy || !googleReady}
        onClick={() => void onGoogle()}
        title={!googleReady ? "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env" : undefined}
        className="w-full rounded-lg border border-zinc-600 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Continue with Google
      </button>
      {!googleReady ? (
        <p className="text-xs text-zinc-600">
          Google sign-in is disabled until OAuth env vars are set.
        </p>
      ) : null}
      <form onSubmit={(e) => void onMagicLink(e)} className="space-y-2">
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-500">Email (magic link)</span>
          <input
            required
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500/60"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send magic link"}
        </button>
      </form>
      {msg ? <p className="text-sm text-zinc-400">{msg}</p> : null}
    </div>
  );
}
