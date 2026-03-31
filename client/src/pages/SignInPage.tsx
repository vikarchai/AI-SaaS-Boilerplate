import { AuthPanel } from "../components/AuthPanel.js";

export function SignInPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-14">
      <div className="space-y-2">
        <p className="text-sm font-medium tracking-wide text-emerald-400/90">
          Authentication
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Sign in</h1>
        <p className="text-sm leading-relaxed text-zinc-500">
          Set <code className="text-zinc-400">BETTER_AUTH_*</code> and optional{" "}
          <code className="text-zinc-400">GOOGLE_*</code> in{" "}
          <code className="text-zinc-400">.env</code>. Magic link URLs are printed in the
          server terminal until you add real email delivery.
        </p>
      </div>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 shadow-xl shadow-black/20 backdrop-blur-sm">
        <AuthPanel />
      </section>
    </div>
  );
}
